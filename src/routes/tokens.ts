import {Elysia, t} from "elysia";
import {authPlugin} from "../plugins/auth";
import {restrictorBefore, restrictorAfter} from "../plugins/restrictor";
import User, {IPasskey} from "../models/user";
import Token from "../models/token";
import * as xaraToken from "../utils/xara_token";
import * as codeSession from "../utils/code_session";
import * as passkeySession from "../utils/passkey_session";
import sendMail from "../utils/mail_sender";
import {getIPAddress, getUserAgent} from "../utils/visitor";
import {getMust} from "../config";
import {
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {HEADER_REFRESH_TOKEN, SESSION_TYPE_CREATE_TOKEN} from "../init/const";
import {sha256hex} from "../utils/native";
import {useCache} from "../init/cache";
const cache = useCache();

/**
 * Token management routes
 */
export const tokensRoutes = new Elysia({prefix: "/tokens"})
    .use(authPlugin)
    /**
     * Validate a token is valid or not
     */
    .head("/:token_id_prefix/:token_id_suffix",
        async ({params, status}) => {
            const {
                token_id_prefix: tokenIdPrefix,
                token_id_suffix: tokenIdSuffix,
            } = params;

            const tokenState = await Token.findById(tokenIdPrefix).exec();
            if (!tokenState) return status(404);

            const user = await User.findById(tokenState.userId).exec();
            if (!user) return status(404);

            if (parseInt(tokenIdSuffix) !== user.revision) return status(404);

            return new Response(null, {status: 200});
        }, {
            params: t.Object({
                token_id_prefix: t.String(),
                token_id_suffix: t.String(),
            }),
        })
    /**
     * Issue a token session for a user (Email Code)
     */
    .post("/", async ({body, set, request, server, status}) => {
        const email = body.email.toLowerCase();

        const user = await User.findOne({email}).exec();
        if (!user) return status(404);

        const metadata = {
            userId: user.id,
            email: user.email,
        };
        const {code, sessionId} = codeSession.createOne(
            "create_token", metadata, 6, 1800,
        );

        const userData = user.toObject();
        const audienceUrl = getMust("SARA_AUDIENCE_URL");

        const sessionTm = new Date().toISOString();
        const sessionUa = getUserAgent(request.headers, true);
        const sessionIp = getIPAddress(request, server);

        try {
            await sendMail("verify_create_token", {
                to: userData.email,
                audienceUrl,
                userId: userData._id,
                userNickname: userData.nickname,
                userEmail: userData.email,
                sessionIp,
                sessionId,
                sessionUa,
                sessionTm,
                code,
            });
            if (getMust("NODE_ENV") === "testing") {
                cache.set("_testing_code", code);
            }
        } catch (e) {
            console.error(e);
            return status(500);
        }

        set.status = 201;
        return {
            session_type: SESSION_TYPE_CREATE_TOKEN,
            session_ip: sessionIp,
            session_id: sessionId,
            session_ua: sessionUa,
            session_tm: sessionTm,
        };
    }, {
        body: t.Object({
            email: t.String({format: "email"}),
        }),
        beforeHandle: restrictorBefore(10, 3600, false),
        afterResponse: restrictorAfter(3600, false, 404),
    })
    /**
     * Verify user's identity and issue an access token by a code
     */
    .patch("/", async ({body, set, request, server, status}) => {
        const metadata = codeSession.getOne(
            "create_token",
            body.session_id,
            body.code,
        );

        if (!metadata) return status(403);
        metadata.deleteIt();

        const user = await User.findOne({email: metadata.email}).exec();
        if (!user) return status(404);

        if (user.id !== metadata.userId) return status(403);

        const userData = user.toObject();
        userData.avatar_hash = sha256hex(userData.email.toLowerCase());

        const token = await xaraToken.issue(userData);

        set.headers[HEADER_REFRESH_TOKEN] = token;
        set.status = 201;

        // Notify user via email
        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const sessionIp = getIPAddress(request, server);
        const accessUa = getUserAgent(request.headers, true);

        sendMail("notify_create_token", {
            to: userData.email,
            audienceUrl,
            userId: userData._id,
            userNickname: userData.nickname,
            userEmail: userData.email,
            sessionId: body.session_id,
            accessMethod: "Email Code",
            accessTm: new Date().toISOString(),
            accessUa,
            accessIp: sessionIp,
        }).catch(console.error);

        return {message: "Token issued"};
    }, {
        body: t.Object({
            code: t.String({minLength: 6, maxLength: 6}),
            session_id: t.String(),
        }),
        beforeHandle: restrictorBefore(10, 3600, false),
        afterResponse: restrictorAfter(3600, false),
    })
    /**
     * Issue a passkey session for a user
     */
    .post("/passkeys", async ({body, set, status}) => {
        const email = body.email.toLowerCase();

        const user = await User.findOne({email}).exec();
        if (!user || !user.passkeys.length) return status(404);

        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const {hostname: audienceHost} = new URL(audienceUrl);

        const allowCredentials = user.passkeys.map((passkey: IPasskey) => ({
            id: passkey.id,
        }));

        const sessionOptions = await generateAuthenticationOptions({
            rpID: audienceHost,
            allowCredentials,
        });

        const metadata = {
            userId: user.id,
            challenge: sessionOptions.challenge,
        };
        const {sessionId} = passkeySession.createOne(
            "create_token", metadata, 1800,
        );

        set.status = 201;
        return {
            session_type: SESSION_TYPE_CREATE_TOKEN,
            session_id: sessionId,
            session_options: sessionOptions,
        };
    }, {
        body: t.Object({
            email: t.String({format: "email"}),
        }),
        beforeHandle: restrictorBefore(10, 3600, false),
        afterResponse: restrictorAfter(3600, false),
    })
    /**
     * Verify user's identity and issue an access token by passkey
     */
    .patch("/passkeys", async ({body, set, request, server, status}) => {
        const metadata = passkeySession.getOne("create_token", body.session_id);

        if (!metadata) return status(403);
        metadata.deleteIt();

        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const {hostname: audienceHost} = new URL(audienceUrl);

        const user = await User.findById(metadata.userId).exec();
        if (!user) return status(404);

        const {credential} = body;
        const passkey = user.passkeys.find(
            (pk: IPasskey) => pk.id === credential.id,
        );

        if (!passkey) return status(403);

        let verification;
        try {
            verification = await verifyAuthenticationResponse({
                response: credential as any,
                credential: passkey as any,
                expectedChallenge: metadata.challenge,
                expectedOrigin: audienceUrl,
                expectedRPID: audienceHost,
            });
        } catch (e) {
            console.error(e);
            return status(403);
        }

        if (!verification.verified) return status(403);

        const userData = user.toObject();
        userData.avatar_hash = sha256hex(userData.email.toLowerCase());

        const token = await xaraToken.issue(userData);

        set.headers[HEADER_REFRESH_TOKEN] = token;
        set.status = 201;

        // Notify user
        sendMail("notify_create_token", {
            to: userData.email,
            audienceUrl,
            userId: userData._id,
            userNickname: userData.nickname,
            userEmail: userData.email,
            sessionId: body.session_id,
            accessMethod: `Passkey (${passkey.label})`,
            accessTm: new Date().toISOString(),
            accessUa: getUserAgent(request.headers, true),
            accessIp: getIPAddress(request, server),
        }).catch(console.error);

        return {message: "Token issued"};
    }, {
        body: t.Object({
            session_id: t.String(),
            credential: t.Object({
                id: t.String(),
                rawId: t.String(),
                response: t.Object({
                    authenticatorData: t.String(),
                    clientDataJSON: t.String(),
                    signature: t.String(),
                    userHandle: t.Optional(t.String()),
                }),
                type: t.String(),
                clientExtensionResults: t.Object({}),
                authenticatorAttachment: t.Optional(t.String()),
            }),
        }),
        beforeHandle: restrictorBefore(10, 3600, false),
        afterResponse: restrictorAfter(3600, false),
    });
