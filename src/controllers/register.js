const {StatusCodes} = require("http-status-codes");
const {Router: expressRouter} = require("express");

// Import modules
const
    crypto = require("crypto");
const util = {
    mail_sender: require("../utils/mail_sender"),
    sara_token: require("../utils/sara_token"),
    ip_address: require("../utils/ip_address"),
};
const schema = {
    user: require("../schemas/user"),
};
const middleware = {
    inspector: require("../middlewares/inspector"),
    validator: require("express-validator"),
};

// Export routes mapper (function)
module.exports = (ctx, r) => {
    const router = expressRouter();

    router.post("/",
        middleware.validator.body("nickname").isString(),
        middleware.validator.body("email").isEmail(),
        middleware.inspector,
        async (req, res) => {
            const code = crypto.randomInt(1000000, 9999999);
            const data = {
                to: req.body.email,
                website: process.env.WEBSITE_URL,
                ip_address: util.ip_address(req),
                code,
            };
            util.mail_sender("register", data).catch(console.error);
            const User = ctx.database.model("User", schema.user);
            if (await User.findOne({email: req.body.email})) {
                res.sendStatus(StatusCodes.CONFLICT);
                return;
            }
            const metadata = {
                nickname: req.body.nickname,
                email: req.body.email,
                created_at: ctx.now(),
                updated_at: ctx.now(),
            };
            const registerToken = util.sara_token.issueCodeToken(
                ctx, code, metadata,
            );
            res.send({register_token: registerToken});
        },
    );

    router.post("/verify",
        middleware.validator.body("code").isNumeric(),
        middleware.validator.body("code").isLength({min: 7, max: 7}),
        middleware.validator.body("registerToken").isString(),
        middleware.inspector,
        async (req, res) => {
            const registerTokenData = util.sara_token.validateCodeToken(
                ctx, req.body.code, req.body.registerToken,
            );
            if (!registerTokenData) {
                res.sendStatus(StatusCodes.UNAUTHORIZED);
                return;
            }
            if (util.sara_token.isGone(ctx, registerTokenData)) {
                res.sendStatus(StatusCodes.GONE);
                return;
            }
            const User = ctx.database.model("User", schema.user);
            if (await User.findOne({email: registerTokenData.sub})) {
                res.sendStatus(StatusCodes.CONFLICT);
                return;
            }
            const metadata = await (new User(registerTokenData.user)).save();
            const token = util.sara_token.issueAuthToken(ctx, metadata);
            res.header("Sara-Issue", token).sendStatus(StatusCodes.CREATED);
        },
    );

    r.use("/register", router);
};
