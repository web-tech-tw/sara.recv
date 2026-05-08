import { Elysia, t } from "elysia";
import { authPlugin } from "../plugins/auth";
import { restrictorBefore, restrictorAfter } from "../plugins/restrictor";
import User from "../models/user";
import * as xaraToken from "../utils/xara_token";
import * as codeSession from "../utils/code_session";
import * as passkeySession from "../utils/passkey_session";
import sendMail from "../utils/mail_sender";
import { getIPAddress, getUserAgent } from "../utils/visitor";
import { getMust } from "../config";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
    APP_NAME,
    HEADER_REFRESH_TOKEN,
    SESSION_TYPE_CREATE_USER,
    SESSION_TYPE_CREATE_PASSKEY,
    SESSION_TYPE_UPDATE_EMAIL
} from "../init/const";
import { sha256hex, generateRandomCode } from "../utils/native";
import { useCache } from "../init/cache";

const cache = useCache();

export const usersRoutes = new Elysia({ prefix: "/users" })
    .use(authPlugin)
    /**
     * Get user profile
     */
    .get("/me", async ({ auth, error }: any) => {
        const userId = auth!.id;
        const user = await User.findById(userId).exec();
        if (!user) return error(404);

        const profile = user.toObject();
        profile.avatar_hash = sha256hex(profile.email.toLowerCase());

        return { profile };
    }, {
        access: null
    })
    /**
     * Update user profile
     */
    .put("/me", async ({ auth, body, set, error }: any) => {
        const user = await User.findById(auth!.id).exec();
        if (!user) return error(404);

        user.nickname = body.nickname || auth!.metadata.profile.nickname;

        if (user.nickname === APP_NAME) return error(403);

        user.revision++;
        const updatedUser = (await user.save()).toObject();

        const token = xaraToken.update(auth!.secret, updatedUser);
        set.headers[HEADER_REFRESH_TOKEN] = token;
        set.status = 201;
        return { message: "Profile updated" };
    }, {
        access: null,
        body: t.Object({
            nickname: t.Optional(t.String())
        })
    })
    /**
     * Delete user profile (soft delete)
     */
    .delete("/me", async ({ auth, set, error }: any) => {
        const user = await User.findById(auth!.id).exec();
        if (!user) return error(404);

        user.nickname = APP_NAME;
        user.email = new Date().toISOString();
        user.passkeys = [];

        await user.save();

        set.headers[HEADER_REFRESH_TOKEN] = "|";
        set.status = 204;
    }, {
        access: null
    })
    /**
     * Update user's email (request session)
     */
    .put("/me/email", async ({ auth, body, request, server, error }: any) => {
        const email = body.email.toLowerCase();

        const metadata = {
            userId: auth!.id,
            email,
        };
        const { code, sessionId } = codeSession.createOne("create_email", metadata, 8, 1800);

        if (await User.findOne({ email }).exec()) return error(409);

        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const userData = auth!.metadata.profile;

        const sessionTm = new Date().toISOString();
        const sessionUa = getUserAgent(request.headers, true);
        const sessionIp = getIPAddress(request, server);

        try {
            await sendMail("verify_update_email", {
                to: email,
                audienceUrl,
                userId: userData._id,
                userNickname: userData.nickname,
                userEmailOriginal: userData.email,
                userEmailUpdated: email,
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
            return error(500);
        }

        return {
            session_type: SESSION_TYPE_UPDATE_EMAIL,
            session_ip: sessionIp,
            session_id: sessionId,
            session_ua: sessionUa,
            session_tm: sessionTm,
        };
    }, {
        access: null,
        body: t.Object({ email: t.String({ format: "email" }) }),
        beforeHandle: restrictorBefore(10, 60, false),
        afterResponse: restrictorAfter(60, false, 409)
    })
    /**
     * Update user email by verification code
     */
    .patch("/me/email", async ({ auth, body, set, request, server, error }: any) => {
        const metadata = codeSession.getOne("create_email", body.session_id, body.code);
        if (!metadata) return error(403);
        metadata.deleteIt();

        if (auth!.id !== metadata.userId) return error(403);

        const user = await User.findById(auth!.id).exec();
        if (!user) return error(404);

        const userEmailOriginal = user.email;
        const userEmailUpdated = metadata.email;

        user.email = userEmailUpdated;
        user.revision++;
        const userData = (await user.save()).toObject();

        const token = xaraToken.update(auth!.secret, userData);
        set.headers[HEADER_REFRESH_TOKEN] = token;
        set.status = 201;

        // Notify
        sendMail("notify_update_email", {
            to: userEmailUpdated,
            cc: [userEmailOriginal],
            audienceUrl: getMust("SARA_AUDIENCE_URL"),
            userId: userData._id,
            userNickname: userData.nickname,
            userEmailOriginal,
            userEmailUpdated,
            sessionId: body.session_id,
            accessIp: getIPAddress(request, server),
            accessUa: getUserAgent(request.headers, true),
            accessTm: new Date().toISOString(),
        }).catch(console.error);

        return { message: "Email updated" };
    }, {
        access: null,
        body: t.Object({
            code: t.String({ minLength: 8, maxLength: 8 }),
            session_id: t.String()
        }),
        beforeHandle: restrictorBefore(10, 60, false),
        afterResponse: restrictorAfter(60, false)
    })
    /**
     * Add a passkey (request options)
     */
    .post("/me/passkeys", async ({ auth, error }: any) => {
        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const { hostname: audienceHost } = new URL(audienceUrl);

        const user = await User.findById(auth!.id).exec();
        if (!user) return error(404);

        const excludeCredentials = user.passkeys.map((pk: any) => ({ id: pk.id }));

        const sessionOptions = await generateRegistrationOptions({
            rpName: APP_NAME,
            rpID: audienceHost,
            userName: auth!.metadata.profile.email,
            userDisplayName: auth!.metadata.profile.nickname,
            excludeCredentials,
            authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "preferred",
            },
        });

        const metadata = {
            userId: auth!.id,
            challenge: sessionOptions.challenge,
        };
        const { sessionId } = passkeySession.createOne(SESSION_TYPE_CREATE_PASSKEY, metadata, 1800);

        return {
            session_type: SESSION_TYPE_CREATE_PASSKEY,
            session_id: sessionId,
            session_options: sessionOptions,
        };
    }, {
        access: null
    })
    /**
     * Verify and add passkey
     */
    .patch("/me/passkeys", async ({ auth, body, request, error }: any) => {
        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const { hostname: audienceHost } = new URL(audienceUrl);

        const metadata = passkeySession.getOne(SESSION_TYPE_CREATE_PASSKEY, body.session_id);
        if (!metadata) return error(403);
        metadata.deleteIt();

        if (auth!.id !== metadata.userId) return error(403);

        const verification = await verifyRegistrationResponse({
            response: body.credential,
            expectedChallenge: metadata.challenge,
            expectedOrigin: audienceUrl,
            expectedRPID: audienceHost,
        });

        if (!verification.verified || !verification.registrationInfo) return error(403);

        const user = await User.findById(auth!.id).exec();
        if (!user) return error(404);

        const { credential } = verification.registrationInfo;
        const labelPrefix = getUserAgent(request.headers, true);
        const labelSuffix = generateRandomCode(4);
        const label = `${labelPrefix} - ${labelSuffix}`;
        
        user.passkeys.push({ ...credential, label } as any);
        await user.save();

        return { message: "Passkey added" };
    }, {
        access: null,
        body: t.Object({
            session_id: t.String(),
            credential: t.Any()
        })
    })
    /**
     * Update passkey label
     */
    .put("/me/passkeys/:passkey_id", async ({ auth, params, body, error }: any) => {
        const user = await User.findById(auth!.id).exec();
        if (!user) return error(404);

        const passkey = user.passkeys.find((pk: any) => pk.id === params.passkey_id);
        if (!passkey) return error(404);

        passkey.label = body.label;
        await user.save();
        return { message: "Passkey label updated" };
    }, {
        access: null,
        body: t.Object({ label: t.String() }),
        params: t.Object({ passkey_id: t.String() })
    })
    /**
     * Delete passkey
     */
    .delete("/me/passkeys/:passkey_id", async ({ auth, params, error }: any) => {
        const user = await User.findById(auth!.id).exec();
        if (!user) return error(404);

        const index = user.passkeys.findIndex((pk: any) => pk.id === params.passkey_id);
        if (index === -1) return error(404);

        user.passkeys.splice(index, 1);
        await user.save();
        return { message: "Passkey removed" };
    }, {
        access: null,
        params: t.Object({ passkey_id: t.String() })
    })
    /**
     * Get user by ID (Public profile)
     */
    .get("/:user_id", async ({ params, error }: any) => {
        const user = await User.findById(params.user_id).exec();
        if (!user) return error(404);

        const userData = user.toObject();
        return {
            profile: {
                nickname: userData.nickname,
                avatar_hash: sha256hex(userData.email.toLowerCase()),
            },
        };
    }, {
        params: t.Object({ user_id: t.String() }),
        beforeHandle: restrictorBefore(10, 60, true),
        afterResponse: restrictorAfter(60, true, 404)
    })
    /**
     * Register a user (Request session)
     */
    .post("/", async ({ body, request, server, error }: any) => {
        const email = body.email.toLowerCase();

        const metadata = {
            nickname: body.nickname,
            email,
            created_at: Date.now(),
            updated_at: Date.now(),
        };

        if (metadata.nickname === APP_NAME) return error(403);
        if (await User.findOne({ email }).exec()) return error(409);

        const { code, sessionId } = codeSession.createOne(SESSION_TYPE_CREATE_USER, metadata, 7, 1800);

        const sessionTm = new Date().toISOString();
        const sessionUa = getUserAgent(request.headers, true);
        const sessionIp = getIPAddress(request, server);

        try {
            await sendMail("verify_create_user", {
                to: email,
                audienceUrl: getMust("SARA_AUDIENCE_URL"),
                userNickname: metadata.nickname,
                userEmail: email,
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
            return error(500);
        }

        return {
            session_type: SESSION_TYPE_CREATE_USER,
            session_ip: sessionIp,
            session_id: sessionId,
            session_ua: sessionUa,
            session_tm: sessionTm,
        };
    }, {
        body: t.Object({
            nickname: t.String(),
            email: t.String({ format: "email" })
        }),
        beforeHandle: restrictorBefore(20, 3600, false),
        afterResponse: restrictorAfter(3600, false, 409)
    })
    /**
     * Verify registration via code
     */
    .patch("/", async ({ body, set, request, server, error }: any) => {
        const metadata = codeSession.getOne(SESSION_TYPE_CREATE_USER, body.session_id, body.code);
        if (!metadata) return error(403);
        metadata.deleteIt();

        if (await User.findOne({ email: metadata.email }).exec()) return error(409);

        const user = new User(metadata);
        const userData = (await user.save()).toObject();
        userData.avatar_hash = sha256hex(userData.email.toLowerCase());

        const token = await xaraToken.issue(userData);
        set.headers[HEADER_REFRESH_TOKEN] = token;
        set.status = 201;

        // Notify
        sendMail("notify_create_user", {
            to: userData.email,
            audienceUrl: getMust("SARA_AUDIENCE_URL"),
            userId: userData._id,
            userNickname: userData.nickname,
            userEmail: userData.email,
            sessionId: body.session_id,
            accessIp: getIPAddress(request, server),
            accessUa: getUserAgent(request.headers, true),
            accessTm: new Date().toISOString(),
        }).catch(console.error);

        return { message: "User registered" };
    }, {
        body: t.Object({
            code: t.String({ minLength: 7, maxLength: 7 }),
            session_id: t.String()
        }),
        beforeHandle: restrictorBefore(20, 3600, false),
        afterResponse: restrictorAfter(3600, false)
    });
