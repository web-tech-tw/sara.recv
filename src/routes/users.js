"use strict";

const {getMust} = require("../config");

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");
const {useCache} = require("../init/cache");

const User = require("../models/user");

const utilMailSender = require("../utils/mail_sender");
const utilXaraToken = require("../utils/xara_token");
const utilCodeSession = require("../utils/code_session");
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
        const {
            profile,
        } = req.auth.metadata;
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

        // Update values
        const userData = await utilUser.saveData(user);

        // Generate token
        const token = utilXaraToken.
            update(req.auth.secret, userData);

        // Send response
        res.
            header("x-sara-refresh", token).
            sendStatus(StatusCodes.CREATED);
    },
);

/**
 * @openapi
 * /users/me/email:
 *   put:
 *     summary: Update user's email
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
    middlewareRestrictor(10, 60, false),
    async (req, res) => {
        // Handle code and metadata
        const metadata = {
            userId: req.auth.id,
            email: req.body.email,
        };
        const {code, sessionId} = utilCodeSession.
            createOne(metadata, 8, 1800);

        // Handle conflict
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Handle mail
        try {
            await utilMailSender("update_email", {
                name: req.auth.metadata?.profile?.nickname,
                origin: req.auth.metadata?.profile?.email,
                to: req.body.email,
                website: getMust("SARA_AUDIENCE_URL"),
                ip_address: utilVisitor.getIPAddress(req),
                session_id: sessionId,
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
            session_type: "update_email",
            session_id: sessionId,
        });
    },
);

/**
 * @openapi
 * /users/me/email:
 *   patch:
 *     summary: Update user email by verification code.
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
            getOne(req.body.session_id, req.body.code);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        } else {
            // Remove session
            utilCodeSession.
                deleteOne(req.body.session_id, req.body.code);
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
        user.email = metadata.email;

        // Update values
        const userData = await utilUser.saveData(user);

        // Generate token
        const token = utilXaraToken.
            update(req.auth.secret, userData);

        // Send response
        res.
            header("x-sara-refresh", token).
            sendStatus(StatusCodes.CREATED);
    },
);

/**
 * @openapi
 * /users:
 *   post:
 *     tags:
 *       - users
 *     summary: Register a user
 *     description: Endpoint to register a user
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
 *       409:
 *         description: Returns an error message
 *                      if the user's email already exists in the system.
 */
router.post("/",
    middlewareValidator.body("nickname").notEmpty(),
    middlewareValidator.body("email").isEmail(),
    middlewareInspector,
    middlewareRestrictor(20, 3600, false),
    async (req, res) => {
        // Handle code and metadata
        const metadata = {
            nickname: req.body.nickname,
            email: req.body.email,
            created_at: utilNative.getPosixTimestamp(),
            updated_at: utilNative.getPosixTimestamp(),
        };
        const {code, sessionId} = utilCodeSession.
            createOne(metadata, 7, 1800);

        // Handle mail
        try {
            await utilMailSender("create_user", {
                name: metadata.nickname,
                to: req.body.email,
                website: getMust("SARA_AUDIENCE_URL"),
                ip_address: utilVisitor.getIPAddress(req),
                session_id: sessionId,
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
                session_id: sessionId,
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
            getOne(req.body.session_id, req.body.code);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        } else {
            // Remove session
            utilCodeSession.
                deleteOne(req.body.session_id, req.body.code);
        }

        // Handle conflict
        if (await User.findOne({email: metadata.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Handle creation
        const user = new User(metadata);
        const userData = await utilUser.saveData(user);

        // Generate token
        const token = utilXaraToken.
            issue(userData);

        // Send response
        res.
            header("x-sara-refresh", token).
            sendStatus(StatusCodes.CREATED);
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/users", router);
};
