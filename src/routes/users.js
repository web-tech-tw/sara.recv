"use strict";

const {getMust} = require("../config");

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");
const {useCache} = require("../init/cache");

const {
    APP_NAME: issuerIdentity,
    HEADER_REFRESH_TOKEN: headerRefreshToken,
    SESSION_TYPE_CREATE_USER: sessionTypeCreateUser,
    SESSION_TYPE_UPDATE_EMAIL: sessionTypeUpdateEmail,
} = require("../init/const");

const User = require("../models/user");

const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
} = require("@simplewebauthn/server");

const utilMailSender = require("../utils/mail_sender");
const utilXaraToken = require("../utils/xara_token");
const utilCodeSession = require("../utils/code_session");
const utilPasskeySession = require("../utils/passkey_session");
const utilVisitor = require("../utils/visitor");
const utilUser = require("../utils/user");
const utilNative = require("../utils/native");

const middlewareAccess = require("../middleware/access");
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
 * /users/me:
 *   get:
 *     summary: Get user profile
 *     description: Returns the authenticated user's profile.
 *     tags:
 *       - users
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   $ref: '#/components/schemas/User'
 */
router.get("/me",
    middlewareAccess(null),
    async (req, res) => {
        const userId = req.auth.id;

        const user = await User.findById(userId).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        const profile = user.toObject();

        const avatarRaw = profile.email.toLowerCase();
        const avatarHash = utilNative.sha256hex(avatarRaw);
        profile.avatar_hash = avatarHash;

        res.send({profile});
    },
);

/**
 * @openapi
 * /users/me:
 *   put:
 *     summary: Update user profile
 *     description: Updates the authenticated user's profile.
 *     tags:
 *       - users
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       description: User object to be updated
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *     responses:
 *       201:
 *         description: User profile updated successfully
 *         headers:
 *           x-sara-refresh:
 *             description: Bearer token for the updated profile
 *             schema:
 *               type: string
 *       403:
 *         description: Reserved words are not allowed
 *       404:
 *         description: User not found
 */
router.put("/me",
    middlewareAccess(null),
    async (req, res) => {
        // Check user exists by the ID
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle updates
        user.nickname = req.body?.nickname ||
            req.auth.metadata.profile.nickname;

        // Check reserved words
        if (user.nickname === issuerIdentity) {
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Save user data
        const userData = await utilUser.saveData(user);

        // Generate token
        const token = utilXaraToken.
            update(req.auth.secret, userData);

        // Send response
        res.
            header(headerRefreshToken, token).
            sendStatus(StatusCodes.CREATED);
    },
);

/**
 * @openapi
 * /users/me:
 *   delete:
 *     summary: Delete user profile
 *     description: Deletes the authenticated user's profile. (soft delete)
 *     tags:
 *       - users
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       204:
 *         description: User profile deleted successfully
 *         headers:
 *           x-sara-refresh:
 *             description: Use a character to empty the token
 *             schema:
 *               type: string
 *       404:
 *         description: User not found
 */
router.delete("/me",
    middlewareAccess(null),
    async (req, res) => {
        // Check user exists by the ID
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle updates
        user.nickname = issuerIdentity;
        user.email = new Date().toISOString();

        // Update values
        await utilUser.saveData(user);

        // Send response
        res.
            header(headerRefreshToken, "|").
            sendStatus(StatusCodes.NO_CONTENT);
    },
);

/**
 * @openapi
 * /users/me/email:
 *   put:
 *     summary: Update user's email
 *     description: Updates the authenticated user's email.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     tags:
 *       - users
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address of the user
 *     responses:
 *       200:
 *         description: Session created to update user's email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_type:
 *                   type: string
 *                   description: Type of the session created
 *                   example: update_email
 *                 session_id:
 *                   type: string
 *                   description: ID of the session created
 *                   example: 62159db19d393b330e57ca63
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Rate limit exceeded
 *       409:
 *         description: Email address already in use
 *       500:
 *         description: Internal server error
 */
router.put("/me/email",
    middlewareAccess(null),
    middlewareValidator.body("email").isEmail().notEmpty(),
    middlewareInspector,
    middlewareRestrictor(10, 60, false, StatusCodes.CONFLICT),
    async (req, res) => {
        // Handle code and metadata
        const metadata = {
            userId: req.auth.id,
            email: req.body.email,
        };
        const {code, sessionId} = utilCodeSession.
            createOne("create_email", metadata, 8, 1800);

        // Handle conflict
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Fetch email variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");

        const {profile: userData} = req.auth.metadata;

        const userId = userData._id;
        const userNickname = userData.nickname;
        const userEmailOriginal = userData.email;
        const userEmailUpdated = metadata.email;

        const sessionTm = new Date().toISOString();
        const sessionUa = utilVisitor.getUserAgent(req, true);
        const sessionIp = utilVisitor.getIPAddress(req);

        // Send email
        try {
            await utilMailSender("verify_update_email", {
                to: userEmailUpdated,
                audienceUrl,
                userId,
                userNickname,
                userEmailOriginal,
                userEmailUpdated,
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
        res.send({
            session_type: sessionTypeUpdateEmail,
            session_ip: sessionIp,
            session_id: sessionId,
            session_ua: sessionUa,
            session_tm: sessionTm,
        });
    },
);

/**
 * @openapi
 * /users/me/email:
 *   patch:
 *     summary: Update user email by verification code.
 *     description: Update the authenticated user's email by verification code.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     tags:
 *       - users
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 8
 *               session_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: The email is updated successfully.
 *       401:
 *         description: Invalid verification code or session ID.
 *       404:
 *         description: The user is not found.
 */
router.patch("/me/email",
    middlewareAccess(null),
    middlewareValidator.body("code").isNumeric().notEmpty(),
    middlewareValidator.body("code").isLength({min: 8, max: 8}).notEmpty(),
    middlewareValidator.body("session_id").isString().notEmpty(),
    middlewareInspector,
    middlewareRestrictor(10, 60, false),
    async (req, res) => {
        // Get metadata back by the code
        const metadata = utilCodeSession.
            getOne("create_email", req.body.session_id, req.body.code);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        } else {
            // Remove session
            metadata.deleteIt();
        }

        if (req.auth.id !== metadata.userId) {
            // Check metadata
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Check user exists by the ID
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle updates
        const userEmailOriginal = user.email;
        const userEmailUpdated = metadata.email;

        user.email = userEmailUpdated;

        // Save user data
        const userData = await utilUser.saveData(user);

        // Generate token
        const token = utilXaraToken.
            update(req.auth.secret, userData);

        // Send response
        res.
            header(headerRefreshToken, token).
            sendStatus(StatusCodes.CREATED);

        // Fetch email variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");

        const userId = userData._id;
        const userNickname = userData.nickname;

        const sessionId = req.body.session_id;
        const accessTm = new Date().toISOString();
        const accessUa = utilVisitor.getUserAgent(req, true);
        const accessIp = utilVisitor.getIPAddress(req);

        // Send email
        try {
            await utilMailSender("notify_update_email", {
                to: userEmailUpdated,
                cc: [userEmailOriginal],
                audienceUrl,
                userId,
                userNickname,
                userEmailOriginal,
                userEmailUpdated,
                sessionId,
                accessIp,
                accessUa,
                accessTm,
            });
        } catch (e) {
            console.error(e);
            res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
        }
    },
);


/**
 * @openapi
 * /users/me/passkeys:
 *   post:
 *     tags:
 *       - users
 *     summary: Add a passkey to the user
 *     description: Issues a passkey session for a user
 *                  to add a passkey to their account.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
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
router.post("/me/passkeys",
    middlewareAccess(null),
    async (req, res) => {
        // Fetch audience variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const {hostname: audienceHost} = new URL(audienceUrl);

        // Check user exists by the ID
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Fetch exclude credentials
        const {passkeys} = user;
        const excludeCredentials = passkeys.map((passkey) => ({
            id: passkey.id,
        }));

        // Generate options
        const sessionOptions = await generateRegistrationOptions({
            rpName: issuerIdentity,
            rpID: audienceHost,
            userName: req.auth.metadata.profile.email,
            userDisplayName: req.auth.metadata.profile.nickname,
            excludeCredentials,
            authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "preferred",
            },
        });

        const metadata = {
            userId: req.auth.id,
            challenge: sessionOptions.challenge,
        };
        const {sessionId} = utilPasskeySession.
            createOne("create_passkey", metadata, 1800);

        // Send response
        res.send({
            session_id: sessionId,
            session_options: sessionOptions,
        });
    },
);

/**
 * @openapi
 * /users/me/passkeys:
 *   patch:
 *     tags:
 *       - users
 *     summary: Verify user's passkey to add it into the account
 *     description: Verify user's passkey to add it into the account.
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
 *       401:
 *         description: Returns "Unauthorized"
 *                      if the user's identity cannot be verified.
 *       404:
 *         description: Returns "Not Found" if the user cannot be found.
 */
router.patch("/me/passkeys",
    middlewareAccess(null),
    middlewareValidator.body("session_id").isString().notEmpty(),
    middlewareValidator.body("credential").isObject().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        // Fetch audience variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");
        const {hostname: audienceHost} = new URL(audienceUrl);

        // Get metadata back by the session ID
        const metadata = utilPasskeySession.
            getOne("create_passkey", req.body.session_id);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        } else {
            // Remove session
            metadata.deleteIt();
        }

        if (req.auth.id !== metadata.userId) {
            // Check metadata
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Verify registration response
        const verification = await verifyRegistrationResponse({
            response: req.body.credential,
            expectedChallenge: metadata.challenge,
            expectedOrigin: audienceUrl,
            expectedRPID: audienceHost,
        });

        if (!verification.verified || !verification.registrationInfo) {
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Check user exists by the ID
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle updates
        if (!user.passkeys) {
            user.passkeys = [];
        }

        const {registrationInfo} = verification;
        const {credential} = registrationInfo;
        credential.name = utilVisitor.getUserAgent(req, true);
        user.passkeys.push(credential);

        // Save user data
        await utilUser.saveData(user);

        // Send response
        res.sendStatus(StatusCodes.CREATED);
    },
);

/**
 * @openapi
 * /users/{user_id}:
 *   get:
 *     summary: Get user by ID
 *     description: Get user public profile by ID
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     tags:
 *       - users
 *     parameters:
 *       - name: user_id
 *         in: path
 *         description: ID of the user to retrieve
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *     responses:
 *       200:
 *         description: User public profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get("/:user_id",
    middlewareValidator.param("user_id").isMongoId().notEmpty(),
    middlewareInspector,
    middlewareRestrictor(10, 60, true, StatusCodes.NOT_FOUND),
    async (req, res) => {
        // Assign shortcuts
        const userId = req.params.user_id;

        // Check user exists by the ID
        const user = await User.findById(userId).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle conversion
        const userData = user.toObject();

        const avatarRaw = userData.email.toLowerCase();
        const avatarHash = utilNative.sha256hex(avatarRaw);

        // Send response
        res.send({
            profile: {
                nickname: userData.nickname,
                avatar_hash: avatarHash,
            },
        });
    },
);

/**
 * @openapi
 * /users:
 *   post:
 *     tags:
 *       - users
 *     summary: Register a user
 *     description: This API endpoint registers a new user.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nickname
 *               - email
 *             properties:
 *               nickname:
 *                 type: string
 *               email:
 *                 type: string
 *           example:
 *             nickname: JohnDoe
 *             email: johndoe@example.com
 *     responses:
 *       201:
 *         description: Returns the session ID
 *                      if the user is registered successfully.
 *       400:
 *         description: Returns an error message if the request is invalid.
 *       403:
 *         description: Reserved words are not allowed.
 *       409:
 *         description: Returns an error message
 *                      if the user's email already exists in the system.
 */
router.post("/",
    middlewareValidator.body("nickname").notEmpty(),
    middlewareValidator.body("email").isEmail(),
    middlewareInspector,
    middlewareRestrictor(20, 3600, false, StatusCodes.CONFLICT),
    async (req, res) => {
        // Handle code and metadata
        const metadata = {
            nickname: req.body.nickname,
            email: req.body.email,
            created_at: Date.now(),
            updated_at: Date.now(),
        };
        const {code, sessionId} = utilCodeSession.
            createOne(sessionTypeCreateUser, metadata, 7, 1800);

        // Check reserved words
        if (metadata.nickname === issuerIdentity) {
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Fetch email variables
        const audienceUrl = getMust("SARA_AUDIENCE_URL");

        const userNickname = metadata.nickname;
        const userEmail = metadata.email;

        const sessionTm = new Date().toISOString();
        const sessionUa = utilVisitor.getUserAgent(req, true);
        const sessionIp = utilVisitor.getIPAddress(req);

        // Send email
        try {
            await utilMailSender("verify_create_user", {
                to: userEmail,
                audienceUrl,
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

        // Handle conflict
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Send response
        res.
            status(StatusCodes.CREATED).
            send({
                session_type: "user",
                session_ip: sessionIp,
                session_id: sessionId,
                session_ua: sessionUa,
                session_tm: sessionTm,
            });
    },
);

/**
 * @openapi
 * /users:
 *   patch:
 *     tags:
 *       - users
 *     summary: Verify user's registration via code sent to email
 *     description: This API endpoint verifies the user's registration using
 *                  a code that was sent to their email address.
 *                  It also includes a restrictor middleware that limits
 *                  the rate at which the endpoint can be accessed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - session_id
 *             properties:
 *               code:
 *                 type: string
 *               session_id:
 *                 type: string
 *           example:
 *             code: "1234567"
 *             session_id: "abc123"
 *     responses:
 *       '201':
 *         description: Returns a 201 status code with
 *                      a 'x-sara-refresh' token in the header.
 *       '401':
 *         description: Returns a 401 status code
 *                      if the provided code and session ID
 *                      do not match or are invalid.
 *       '409':
 *         description: Returns a 409 status code if a user
 *                      with the provided email address already exists.
 */
router.patch("/",
    middlewareValidator.body("code").isNumeric(),
    middlewareValidator.body("code").isLength({min: 7, max: 7}),
    middlewareValidator.body("session_id").notEmpty(),
    middlewareInspector,
    middlewareRestrictor(20, 3600, false),
    async (req, res) => {
        // Get metadata back by the code
        const metadata = utilCodeSession.
            getOne(sessionTypeCreateUser, req.body.session_id, req.body.code);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        } else {
            // Remove session
            metadata.deleteIt();
        }

        // Handle conflict
        if (await User.findOne({email: metadata.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Handle creation
        const user = new User(metadata);

        // Save user data
        const userData = await utilUser.saveData(user);

        // Handle avatar
        const avatarRaw = userData.email.toLowerCase();
        const avatarHash = utilNative.sha256hex(avatarRaw);
        userData.avatar_hash = avatarHash;

        // Generate token
        const token = utilXaraToken.
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
        const accessIp = utilVisitor.getIPAddress(req);
        const accessUa = utilVisitor.getUserAgent(req, true);
        const accessTm = new Date().toISOString();

        // Send email
        try {
            await utilMailSender("notify_create_user", {
                to: userEmail,
                audienceUrl,
                userId,
                userNickname,
                userEmail,
                sessionId,
                accessIp,
                accessUa,
                accessTm,
            });
        } catch (e) {
            console.error(e);
            res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
        }
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/users", router);
};
