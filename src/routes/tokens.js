"use strict";

const {getMust} = require("../config");
const {StatusCodes} = require("http-status-codes");
const {useApp, withAwait, express} = require("../init/express");
const {useCache} = require("../init/cache");

const {
    HEADER_REFRESH_TOKEN: headerRefreshToken,
    SESSION_TYPE_CREATE_TOKEN: sessionTypeCreateToken,
} = require("../init/const");

const User = require("../models/user");
const Token = require("../models/token");

const {
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const utilMailSender = require("../utils/mail_sender");
const utilXaraToken = require("../utils/xara_token");
const utilCodeSession = require("../utils/code_session");
const utilPasskeySession = require("../utils/passkey_session");
const utilVisitor = require("../utils/visitor");
const utilNative = require("../utils/native");

const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");
const middlewareRestrictor = require("../middleware/restrictor");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.json());

const cache = useCache();

/**
 * @openapi
 * /tokens/{token_id_prefix}/{token_id_suffix}:
 *   head:
 *     summary: Validate a token is valid or not
 *     description: This endpoint is used to validate a token is valid or not.
 *     tags:
 *       - tokens
 *     parameters:
 *       - name: token_id_prefix
 *         in: path
 *         description: ID of the token to validate, included in jti.
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *       - name: token_id_suffix
 *         in: path
 *         description: Revision of the user to validate, included in jti.
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token is valid
 *       400:
 *         description: Token is malformed
 *       404:
 *         description: Token is invalid
 */
router.head("/:token_id_prefix/:token_id_suffix",
    middlewareValidator.param("token_id_prefix").isMongoId().notEmpty(),
    middlewareValidator.param("token_id_suffix").isInt().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Assign shortcuts
        const {
            token_id_prefix: tokenIdPrefix,
            token_id_suffix: tokenIdSuffix,
        } = req.params;

        // Check token exists by the token ID
        const tokenState = await Token.findById(tokenIdPrefix).exec();
        if (!tokenState) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Find user by the user ID
        const user = await User.findById(tokenState.userId).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Check token ID suffix
        if (parseInt(tokenIdSuffix) !== user.revision) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Return response
        res.sendStatus(StatusCodes.OK);
    }),
);

/**
 * @openapi
 * /tokens:
 *   post:
 *     tags:
 *       - tokens
 *     summary: Issue a token session for a user
 *     description: Issues a token session for a user
 *                  by sending an email with a code.
 *                  The user can use the code to verify their identity later.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *                 format: email
 *                 example: test@example.org
 *     responses:
 *       201:
 *         description: Returns a session ID for the user
 *                      to verify their identity later.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_type:
 *                   type: string
 *                   description: The type of the session.
 *                   example: token
 *                 session_id:
 *                   type: string
 *                   description: The ID of the session.
 *       404:
 *         description: Returns "Not Found" if the user cannot be found.
 *       429:
 *         description: Returns "Too Many Requests"
 *                      if the rate limit is exceeded.
 */
router.post("/",
    middlewareValidator.body("email").isEmail(),
    middlewareInspector,
    middlewareRestrictor(10, 3600, false, StatusCodes.NOT_FOUND),
    withAwait(async (req, res) => {
        // Check user exists by the email address
        const user = await User.findOne({email: req.body.email}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle code and metadata
        const metadata = {
            userId: user.id,
            email: user.email,
        };
        const {code, sessionId} = utilCodeSession.
            createOne("create_token", metadata, 6, 1800);

        // Handle conversion
        const userData = user.toObject();

        // Fetch email variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");

        const userId = userData._id;
        const userNickname = userData.nickname;
        const userEmail = userData.email;

        const sessionTm = new Date().toISOString();
        const sessionUa = utilVisitor.getUserAgent(req, true);
        const sessionIp = utilVisitor.getIPAddress(req);

        // Send email
        try {
            await utilMailSender("verify_create_token", {
                to: userEmail,
                audienceUrl,
                userId,
                userNickname,
                userEmail,
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
            res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
        }

        // Send response
        res.
            status(StatusCodes.CREATED).
            send({
                session_type: sessionTypeCreateToken,
                session_ip: sessionIp,
                session_id: sessionId,
                session_ua: sessionUa,
                session_tm: sessionTm,
            });
    }),
);

/**
 * @openapi
 * /tokens:
 *   patch:
 *     tags:
 *       - tokens
 *     summary: Verify user's identity and issue an access token by a code
 *     description: Verify user's identity by checking the session_id and
 *                  code that the user provides.
 *                  If the session_id and code are valid,
 *                  the server issues an access token.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: The code that the user receives in the email.
 *               session_id:
 *                 type: string
 *                 description: The ID of the session that
 *                              the user receives in the email.
 *     responses:
 *       201:
 *         description: Returns a header named
 *                      "x-sara-refresh" that contains the access token.
 *       403:
 *         description: Returns "Forbidden"
 *                      if the user's identity cannot be verified.
 *       404:
 *         description: Returns "Not Found" if the user cannot be found.
 */
router.patch("/",
    middlewareValidator.body("code").isNumeric().notEmpty(),
    middlewareValidator.body("code").isLength({min: 6, max: 6}).notEmpty(),
    middlewareValidator.body("session_id").notEmpty(),
    middlewareInspector,
    middlewareRestrictor(10, 3600, false),
    withAwait(async (req, res) => {
        // Get metadata back by the code
        const metadata = utilCodeSession.
            getOne("create_token", req.body.session_id, req.body.code);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        } else {
            // Remove session
            metadata.deleteIt();
        }

        // Check user exists by the email address
        const user = await User.findOne({email: metadata.email}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Check metadata user id
        if (user.id !== metadata.userId) {
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Handle conversion
        const userData = user.toObject();

        // Handle avatar
        const avatarRaw = userData.email.toLowerCase();
        const avatarHash = utilNative.sha256hex(avatarRaw);
        userData.avatar_hash = avatarHash;

        // Generate token
        const token = await utilXaraToken.
            issue(userData);

        // Send response
        res.
            header(headerRefreshToken, token).
            sendStatus(StatusCodes.CREATED);

        // Fetch email variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");

        const userId = userData._id;
        const userNickname = userData.nickname;
        const userEmail = userData.email;

        const sessionId = req.body.session_id;

        const accessMethod = "Email Code";
        const accessTm = new Date().toISOString();
        const accessUa = utilVisitor.getUserAgent(req, true);
        const accessIp = utilVisitor.getIPAddress(req);

        // Send email
        try {
            await utilMailSender("notify_create_token", {
                to: userEmail,
                audienceUrl,
                userId,
                userNickname,
                userEmail,
                sessionId,
                accessMethod,
                accessTm,
                accessUa,
                accessIp,
            });
        } catch (e) {
            console.error(e);
            res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
        }
    }),
);

/**
 * @openapi
 * /tokens/passkeys:
 *   post:
 *     tags:
 *       - tokens
 *     summary: Issue a passkey session for a user
 *     description: Issues a passkey session for a user by using
 *                  the WebAuthn standard.
 *                  The user can use the passkey to verify
 *                  their identity later.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *                 format: email
 *                 example: test@example.org
 *     responses:
 *       201:
 *         description: Returns a session ID for the user
 *                      to verify their identity later.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_type:
 *                   type: string
 *                   description: The type of the session.
 *                   example: token
 *                 session_id:
 *                   type: string
 *                   description: The ID of the session.
 *       404:
 *         description: Returns "Not Found"
 *                      if the user cannot be found or
 *                      the user has no passkeys.
 *       429:
 *         description: Returns "Too Many Requests"
 *                      if the rate limit is exceeded.
 */
router.post("/passkeys",
    middlewareValidator.body("email").isEmail(),
    middlewareInspector,
    middlewareRestrictor(10, 3600, false),
    withAwait(async (req, res) => {
        // Check user exists by the email address
        const user = await User.findOne({email: req.body.email}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Fetch audience variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const {hostname: audienceHost} = new URL(audienceUrl);

        // Check user has passkeys
        if (!user.passkeys.length) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Fetch allowed credentials
        const allowCredentials = user.passkeys.map((passkey) => ({
            id: passkey.id,
        }));

        // Handle code and metadata
        const sessionOptions = await generateAuthenticationOptions({
            rpID: audienceHost,
            allowCredentials,
        });

        // Create session
        const metadata = {
            userId: user.id,
            challenge: sessionOptions.challenge,
        };
        const {sessionId} = utilPasskeySession.
            createOne("create_token", metadata, 1800);

        // Send response
        res.
            status(StatusCodes.CREATED).
            send({
                session_id: sessionId,
                session_options: sessionOptions,
            });
    }),
);

/**
 * @openapi
 * /tokens/passkeys:
 *   patch:
 *     tags:
 *       - tokens
 *     summary: Verify user's identity and issue an access token by passkey
 *     description: Verify user's identity by checking the session_id and
 *                  code that the user provides.
 *                  If the session_id and credential are valid,
 *                  the server issues an access token.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: The code that the user receives in the email.
 *               session_id:
 *                 type: string
 *                 description: The ID of the session that
 *                              the user receives in the email.
 *     responses:
 *       201:
 *         description: Returns a header named
 *                      "x-sara-refresh" that contains the access token.
 *       403:
 *         description: Returns "Forbidden"
 *                      if the user's identity cannot be verified.
 *       404:
 *         description: Returns "Not Found" if the user cannot be found.
 */
router.patch("/passkeys",
    middlewareValidator.body("session_id").notEmpty(),
    middlewareValidator.body("credential").isObject().notEmpty(),
    middlewareInspector,
    middlewareRestrictor(10, 3600, false),
    withAwait(async (req, res) => {
        // Get metadata back by the session ID
        const metadata = utilPasskeySession.
            getOne("create_token", req.body.session_id);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        } else {
            // Remove session
            metadata.deleteIt();
        }

        // Fetch audience variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const {hostname: audienceHost} = new URL(audienceUrl);

        // Check user exists by the email address
        const user = await User.findById(metadata.userId).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        const {credential} = req.body;
        const passkey = user.passkeys.find((passkey) => {
            return passkey.id === credential.id;
        });

        let verification;
        try {
            verification = await verifyAuthenticationResponse({
                response: credential,
                credential: passkey,
                expectedChallenge: metadata.challenge,
                expectedOrigin: audienceUrl,
                expectedRPID: audienceHost,
            });
        } catch (error) {
            console.error(error);
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        if (!verification.verified) {
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Handle conversion
        const userData = user.toObject();

        // Handle avatar
        const avatarRaw = userData.email.toLowerCase();
        const avatarHash = utilNative.sha256hex(avatarRaw);
        userData.avatar_hash = avatarHash;

        // Generate token
        const token = await utilXaraToken.
            issue(userData);

        // Send response
        res.
            header(headerRefreshToken, token).
            sendStatus(StatusCodes.CREATED);

        // Fetch email variables
        const userId = userData._id;
        const userNickname = userData.nickname;
        const userEmail = userData.email;

        const sessionId = req.body.session_id;

        const accessMethod = `Passkey (${passkey.label})`;
        const accessTm = new Date().toISOString();
        const accessUa = utilVisitor.getUserAgent(req, true);
        const accessIp = utilVisitor.getIPAddress(req);

        // Send email
        try {
            await utilMailSender("notify_create_token", {
                to: userEmail,
                audienceUrl,
                userId,
                userNickname,
                userEmail,
                sessionId,
                accessMethod,
                accessTm,
                accessUa,
                accessIp,
            });
        } catch (e) {
            console.error(e);
            res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
        }
    }),
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/tokens", router);
};
