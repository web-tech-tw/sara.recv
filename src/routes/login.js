"use strict";

const {getMust} = require("../config");
const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");

const utilMailSender = require("../utils/mail_sender");
const utilSaraToken = require("../utils/sara_token");
const utilCodeSession = require("../utils/code_session");
const utilVisitor = require("../utils/visitor");

const schemaUser = require("../schemas/user");

const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");
const middlewareRestrictor = require("../middleware/restrictor");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.urlencoded({extended: true}));

const database = useDatabase();

router.post("/",
    middlewareValidator.body("email").isEmail(),
    middlewareInspector,
    middlewareRestrictor(10, 3600, false),
    async (req, res) => {
        // Check user exists by the email address
        const User = database.model("User", schemaUser);
        if (!(await User.findOne({email: req.body.email}).exec())) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle code and metadata
        const metadata = {email: req.body.email};
        const {code, sessionId} = utilCodeSession.createOne(metadata, 6);

        // Handle mail
        try {
            await utilMailSender("login", {
                to: req.body.email,
                website: getMust("SARA_AUDIENCE_URL"),
                ip_address: utilVisitor.getIPAddress(req),
                code,
            });
        } catch (e) {
            console.error(e);
            res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
        }

        // Send response
        res.
            status(StatusCodes.CREATED).
            send({
                session_type: "login",
                session_id: sessionId,
            });
    },
);

router.post("/verify",
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
        const User = database.model("User", schemaUser);
        const user = await User.findOne({email: metadata.email}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Handle authentication
        const userData = user.toObject();
        const token = utilSaraToken.
            issue(userData);

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
    app.use("/login", router);
};
