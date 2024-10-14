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
 * /tokens:
 *   post:
 *     tags:
 *       - tokens
 *     summary: Issue a token session for a user
 *     description: Issues a token session for a user
 *                  by sending an email with a code.
 *                  The user can use the code to verify their identity later.
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
    middlewareRestrictor(10, 3600, false),
    async (req, res) => {
        // Check user exists by the email address
        const user = await User.findOne({email: req.body.email}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle code and metadata
        const metadata = {
            userId: user._id.toString(),
            email: req.body.email,
        };
        const {code, sessionId} = utilCodeSession.
            createOne(metadata, 6, 1800);

        // Handle mail
        try {
            await utilMailSender("create_token", {
                name: user.nickname,
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
        res.
            status(StatusCodes.CREATED).
            send({
                session_type: "token",
                session_id: sessionId,
            });
    },
);

/**
 * @openapi
 * /tokens:
 *   patch:
 *     tags:
 *       - tokens
 *     summary: Verify user's identity and issue an access token
 *     description: Verify user's identity by checking the session_id and
 *                  code that the user provides.
 *                  If the session_id and code are valid,
 *                  the server issues an access token.
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
router.patch("/",
    middlewareValidator.body("code").isNumeric().notEmpty(),
    middlewareValidator.body("code").isLength({min: 6, max: 6}).notEmpty(),
    middlewareValidator.body("session_id").notEmpty(),
    middlewareInspector,
    middlewareRestrictor(10, 3600, false),
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

        // Check user exists by the email address
        const user = await User.findOne({email: metadata.email}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Check metadata user id
        if (user._id.toString() !== metadata.userId) {
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        // Handle authentication
        const userData = user.toObject();
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
    app.use("/tokens", router);
};
