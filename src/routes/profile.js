"use strict";

const {getMust} = require("../config");

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");
const {useCache} = require("../init/cache");

const utilMailSender = require("../utils/mail_sender");
const utilSaraToken = require("../utils/sara_token");
const utilCodeSession = require("../utils/code_session");
const utilVisitor = require("../utils/visitor");
const utilUser = require("../utils/user");

const schemaUser = require("../schemas/user");

const middlewareAccess = require("../middleware/access");
const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");
const middlewareRestrictor = require("../middleware/restrictor");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.urlencoded({extended: true}));

const database = useDatabase();
const cache = useCache();

/**
 * @openapi
 * /profile:
 *   get:
 *     summary: Get user profile
 *     description: Returns the authenticated user's profile.
 *     tags:
 *       - profile
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
 *                   $ref: '#/components/schemas/UserProfile'
 */
router.get("/",
    middlewareAccess(null),
    async (req, res) => {
        res.send({profile: req.auth.metadata.user});
    },
);

/**
 * @openapi
 * /profile:
 *   put:
 *     summary: Update user profile
 *     description: Updates the authenticated user's profile.
 *     tags:
 *       - profile
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
 *           Sara-Issue:
 *             description: Bearer token for the updated profile
 *             schema:
 *               type: string
 *       404:
 *         description: User not found
 */
router.put("/",
    middlewareAccess(null),
    async (req, res) => {
        // Check user exists by the ID
        const User = database.model("User", schemaUser);
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle updates
        user.nickname =
            req?.body?.nickname ||
            req.auth.metadata.user.nickname;

        // Update values
        const metadata = await utilUser.saveData(user);
        const token = utilSaraToken.
            issue(metadata);

        // Send response
        res
            .header("Sara-Issue", token)
            .sendStatus(StatusCodes.CREATED);
    },
);

/**
 * @openapi
 * /profile/email:
 *   put:
 *     summary: Update user's email
 *     tags:
 *       - profile
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
router.put("/email",
    middlewareAccess(null),
    middlewareValidator.body("email").isEmail().notEmpty(),
    middlewareInspector,
    middlewareRestrictor(10, 60, false),
    async (req, res) => {
        // Handle code and metadata
        const metadata = {
            _id: req.auth.id,
            email: req.body.email,
        };
        const {code, sessionId} = utilCodeSession.createOne(metadata, 8, 1800);

        // Handle conflict
        const User = database.model("User", schemaUser);
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Handle mail
        try {
            await utilMailSender("update_email", {
                to: req.body.email,
                website: getMust("SARA_AUDIENCE_URL"),
                ip_address: utilVisitor.getIPAddress(req),
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
 * /profile/email:
 *   patch:
 *     summary: Update user email by verification code.
 *     tags:
 *       - profile
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
router.patch("/email",
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

        // Check user exists by the ID
        const User = database.model("User", schemaUser);
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Update values
        user.email = metadata.data.email;
        const userData = utilUser.saveData(user);

        // Generate token
        const token = utilSaraToken.issue(userData);

        // Send response
        res
            .header("Sara-Issue", token)
            .sendStatus(StatusCodes.CREATED);
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/profile", router);
};
