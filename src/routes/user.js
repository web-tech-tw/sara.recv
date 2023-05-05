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
const utilNative = require("../utils/native");

const schemaUser = require("../schemas/user");

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
 * /user:
 *   post:
 *     tags:
 *       - user
 *     summary: Register a user
 *     description: Endpoint to register a user
 *     parameters:
 *       - in: body
 *         name: user
 *         schema:
 *           type: object
 *           required:
 *             - nickname
 *             - email
 *           properties:
 *             nickname:
 *               type: string
 *             email:
 *               type: string
 *         required: true
 *         description: The user's nickname and email.
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
        const {code, sessionId} = utilCodeSession.createOne(metadata, 7, 1800);

        // Handle mail
        try {
            await utilMailSender("create_user", {
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

        // Handle conflict
        const User = database.model("User", schemaUser);
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
 * /user:
 *   patch:
 *     tags:
 *       - user
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
 *                      a 'Sara-Issue' token in the header.
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
        const User = database.model("User", schemaUser);
        if (await User.findOne({email: metadata.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Handle creation
        const user = new User(metadata);
        const userData = await utilUser.saveData(user);

        // Generate token
        const token = utilSaraToken.issue(userData);

        // Send response
        res.
            header("Sara-Issue", token).
            sendStatus(StatusCodes.CREATED);
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/user", router);
};
