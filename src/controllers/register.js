const {StatusCodes} = require("http-status-codes");
const {Router: expressRouter} = require("express");

// Import modules
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
            const metadata = {
                nickname: req.body.nickname,
                email: req.body.email,
                created_at: ctx.now(),
                updated_at: ctx.now(),
            };
            const {token, code} = util.sara_token.issueCodeToken(
                ctx, 7, metadata,
            );
            const data = {
                to: req.body.email,
                website: process.env.WEBSITE_URL,
                ip_address: util.ip_address(req),
                code,
            };
            util.mail_sender("register", data).catch(console.error);
            const User = ctx.database.model("User", schema.user);
            if (await User.findOne({email: req.body.email}).exec()) {
                res.sendStatus(StatusCodes.CONFLICT);
                return;
            }
            res.send({register_token: token});
        },
    );

    router.post("/verify",
        middleware.validator.body("code").isNumeric(),
        middleware.validator.body("code").isLength({min: 7, max: 7}),
        middleware.validator.body("register_token").isString(),
        middleware.inspector,
        async (req, res) => {
            const tokenData = util.sara_token.validateCodeToken(
                ctx, req.body.code, req.body.register_token,
            );
            if (!tokenData) {
                res.sendStatus(StatusCodes.UNAUTHORIZED);
                return;
            }
            if (util.sara_token.isGone(ctx, tokenData)) {
                res.sendStatus(StatusCodes.GONE);
                return;
            }
            const User = ctx.database.model("User", schema.user);
            if (await User.findOne({email: tokenData.sub}).exec()) {
                res.sendStatus(StatusCodes.CONFLICT);
                return;
            }
            const user = new User(tokenData.user);
            const metadata = await user.save();
            const {token, secret} = util.sara_token.issueAuthToken(
                ctx, metadata,
            );
            res
                .status(StatusCodes.CREATED)
                .header("Sara-Issue", token)
                .send({secret});
        },
    );

    r.use("/register", router);
};
