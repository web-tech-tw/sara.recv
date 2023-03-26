"use strict";

const {getMust, isProduction} = require("../config");

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");

const utilMailSender = require("../utils/mail_sender");
const utilSaraToken = require("../utils/sara_token");
const utilCodeSession = require("../utils/code_session");
const utilVisitor = require("../utils/visitor");
const utilUser = require("../utils/user");
const utilTesting = require("../utils/testing");

const schemaUser = require("../schemas/user");

const middlewareAccess = require("../middleware/access");
const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.urlencoded({extended: true}));

const database = useDatabase();

router.get("/",
    middlewareAccess(null),
    async (req, res) => {
        res.send({profile: req.auth.metadata.user});
    },
);

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

router.put("/email",
    middlewareAccess(null),
    middlewareValidator.body("email").isEmail().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        // Handle code and metadata
        const metadata = {
            _id: req.auth.id,
            email: req.body.email,
        };
        const {code, sessionId} = utilCodeSession.createOne(metadata, 8);

        // Handle conflict
        const User = database.model("User", schemaUser);
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Handle mail
        const mailState = await utilMailSender("update_email", {
            to: req.body.email,
            website: getMust("SARA_AUDIENCE_URL"),
            ip_address: utilVisitor.getIPAddress(req),
            code,
        });
        if (!isProduction()) {
            utilTesting.log(mailState);
        }

        // Send response
        res.send({
            session_type: "update_email",
            session_id: sessionId,
        });
    },
);

router.post("/email/verify",
    middlewareAccess(null),
    middlewareValidator.body("code").isNumeric().notEmpty(),
    middlewareValidator.body("code").isLength({min: 8, max: 8}).notEmpty(),
    middlewareValidator.body("session_id").isString().notEmpty(),
    middlewareInspector,
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
        const token = utilSaraToken.
            issue(userData);

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
