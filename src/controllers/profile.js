"use strict";

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");

// Import modules
const utilMailSender = require("../utils/mail_sender");
const utilSaraToken = require("../utils/sara_token");
const utilVisitor = require("../utils/visitor");
const utilUser = require("../utils/user");

const schemaUser = require("../schemas/user");

const middlewareAccess = require("../middleware/access");
const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

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
        const User = database.model("User", schemaUser);
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        user.nickname =
            req?.body?.nickname ||
            req.auth.metadata.user.nickname;
        const metadata = await utilUser.saveData(user);
        const {token, secret} = utilSaraToken.issueAuthToken(
            metadata,
        );
        res
            .header("Sara-Issue", token)
            .header("Sara-Code", secret)
            .sendStatus(StatusCodes.CREATED);
    },
);

router.put("/email",
    middlewareAccess(null),
    middlewareValidator.body("email").isEmail().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        const metadata = {
            _id: req.auth.id,
            email: req.body.email,
        };
        const {token, code} = utilSaraToken.issueCodeToken(
            8, metadata,
        );
        const data = {
            to: req.body.email,
            website: process.env.WEBSITE_URL,
            ip_address: utilVisitor.getIPAddress(req),
            code,
        };
        utilMailSender("update_email", data).catch(console.error);
        const User = database.model("User", schemaUser);
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }
        res.send({update_email_token: token});
    },
);

router.post("/email/verify",
    middlewareAccess(null),
    middlewareValidator.body("code").isNumeric().notEmpty(),
    middlewareValidator.body("code").isLength({min: 8, max: 8}).notEmpty(),
    middlewareValidator.body("update_email_token").isString().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        const tokenData = utilSaraToken.validateCodeToken(
            req.body.code, req.body.update_email_token,
        );
        if ((!tokenData) || (tokenData.sub !== req.auth.id)) {
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        }
        if (utilSaraToken.isGone(tokenData)) {
            res.sendStatus(StatusCodes.GONE);
            return;
        }
        const User = database.model("User", schemaUser);
        const user = await User.findById(req.auth.id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        user.email = tokenData.data.email;
        const metadata = utilUser.saveData(user);
        const {token, secret} = utilSaraToken.issueAuthToken(
            metadata,
        );
        res
            .header("Sara-Issue", token)
            .header("Sara-Code", secret)
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
