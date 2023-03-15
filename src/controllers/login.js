"use strict";

const {isProduction} = require("../config");

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");

// Import modules
const constant = require("../init/const");

const utilBFAP = require("../utils/bfap");
const utilMailSender = require("../utils/mail_sender");
const utilSaraToken = require("../utils/sara_token");
const utilVisitor = require("../utils/visitor");

const schemaUser = require("../schemas/user");

const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

const database = useDatabase();

router.post("/",
    middlewareValidator.body("email").isEmail().notEmpty(),
    middlewareInspector,
    (req, res, next) => {
        if (!utilBFAP.inspect(
            constant.BFAP_CONFIG_IP_LOGIN,
            utilVisitor.getIPAddress(req),
        )) return next();
        res.sendStatus(StatusCodes.FORBIDDEN);
        console.error("brute_force");
        return;
    },
    async (req, res) => {
        const User = database.model("User", schemaUser);
        if (!(await User.findOne({email: req.body.email}).exec())) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        const metadata = {email: req.body.email};
        const {token, code} = utilSaraToken.issueCodeToken(6, metadata);
        const data = {
            to: req.body.email,
            website: process.env.WEBSITE_URL,
            ip_address: utilVisitor.getIPAddress(req),
            code,
        };
        utilMailSender("login", data).catch(console.error);
        const result = {next_token: token};
        if (!isProduction()) {
            result.code = code;
        }
        res.send(result);
    },
);

router.post("/verify",
    middlewareValidator.body("code").isNumeric().notEmpty(),
    middlewareValidator.body("code").isLength({min: 6, max: 6}).notEmpty(),
    middlewareValidator.body("next_token").isString().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        const tokenData = utilSaraToken.validateCodeToken(
            req.body.code, req.body.next_token,
        );
        if (!tokenData) {
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        }
        if (utilSaraToken.isGone(tokenData)) {
            res.sendStatus(StatusCodes.GONE);
            return;
        }
        const User = database.model("User", schemaUser);
        const user = await User.findOne({email: tokenData.sub}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        const metadata = user.toObject();
        const {token, secret} = utilSaraToken.issueAuthToken(metadata);
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
    app.use("/login", router);
};
