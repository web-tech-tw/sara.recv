"use strict";

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");

const {getMust, isProduction} = require("../config");

// Import modules
const constant = require("../init/const");

const utilBFAP = require("../utils/bfap");
const utilMailSender = require("../utils/mail_sender");
const utilSaraToken = require("../utils/sara_token");
const utilVisitor = require("../utils/visitor");
const utilUser = require("../utils/user");

const schemaUser = require("../schemas/user");

const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");
const {getPosixTimestamp} = require("../utils/native");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.urlencoded({extended: true}));

const database = useDatabase();

router.post("/",
    middlewareValidator.body("nickname").notEmpty(),
    middlewareValidator.body("email").isEmail(),
    middlewareInspector,
    (req, res, next) => {
        if (!utilBFAP.inspect(
            constant.BFAP_CONFIG_IP_REGISTER,
            utilVisitor.getIPAddress(req),
        )) return next();
        res.sendStatus(StatusCodes.FORBIDDEN);
        console.error("brute_force");
        return;
    },
    async (req, res) => {
        const metadata = {
            nickname: req.body.nickname,
            email: req.body.email,
            created_at: getPosixTimestamp(),
            updated_at: getPosixTimestamp(),
        };
        const {token, code} = utilSaraToken.issueCodeToken(
            7, metadata,
        );
        const data = {
            to: req.body.email,
            website: getMust("SARA_AUDIENCE_URL"),
            ip_address: utilVisitor.getIPAddress(req),
            code,
        };
        utilMailSender("register", data).catch(console.error);
        const User = database.model("User", schemaUser);
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }
        const result = {register_token: token};
        if (!isProduction()) {
            result.code = data.code;
        }
        res.send(result);
    },
);

router.post("/verify",
    middlewareValidator.body("code").isNumeric(),
    middlewareValidator.body("code").isLength({min: 7, max: 7}),
    middlewareValidator.body("register_token").notEmpty(),
    middlewareInspector,
    async (req, res) => {
        const tokenData = utilSaraToken.validateCodeToken(
            req.body.code, req.body.register_token,
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
        if (await User.findOne({email: tokenData.sub}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }
        const user = new User(tokenData.data);
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

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/register", router);
};
