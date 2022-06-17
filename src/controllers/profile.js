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
    access: require("../middlewares/access"),
    inspector: require("../middlewares/inspector"),
    validator: require("express-validator"),
};

// Export routes mapper (function)
module.exports = (ctx, r) => {
    const router = expressRouter();

    router.get("/",
        middleware.access(null),
        async (req, res) => {
            res.send({profile: req.authenticated.user});
        },
    );

    router.put("/",
        middleware.access(null),
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            const user = await User.findById(req.authenticated.sub).exec();
            if (!user) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            user.nickname =
                req?.body?.nickname ||
                req.authenticated.user.nickname;
            user.updated_at = ctx.now();
            const metadata = await user.save();
            ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
            const {token, secret} = util.sara_token.issueAuthToken(
                ctx, metadata,
            );
            res
                .status(StatusCodes.CREATED)
                .header("Sara-Issue", token)
                .send({secret});
        },
    );

    router.put("/email",
        middleware.access(null),
        middleware.validator.body("email").isEmail(),
        middleware.inspector,
        async (req, res) => {
            const metadata = {
                _id: req.authenticated.sub,
                email: req.body.email,
            };
            const {token, code} = util.sara_token.issueCodeToken(
                ctx, 8, metadata,
            );
            const data = {
                to: req.body.email,
                website: process.env.WEBSITE_URL,
                ip_address: util.ip_address(req),
                code,
            };
            util.mail_sender("update_email", data).catch(console.error);
            const User = ctx.database.model("User", schema.user);
            if (await User.findOne({email: req.body.email})) {
                res.sendStatus(StatusCodes.CONFLICT);
                return;
            }
            res.send({update_email_token: token});
        },
    );

    router.post("/email/verify",
        middleware.access(null),
        middleware.validator.body("code").isNumeric(),
        middleware.validator.body("code").isLength({min: 8, max: 8}),
        middleware.validator.body("update_email_token").isString(),
        middleware.inspector,
        async (req, res) => {
            const tokenData = util.sara_token.validateCodeToken(
                ctx, req.body.code, req.body.update_email_token,
            );
            if (!tokenData||tokenData.sub !== req.tokenData.sub) {
                res.sendStatus(StatusCodes.UNAUTHORIZED);
                return;
            }
            if (util.sara_token.isGone(ctx, tokenData)) {
                res.sendStatus(StatusCodes.GONE);
                return;
            }
            const User = ctx.database.model("User", schema.user);
            const user = await User.findById(tokenData.sub).exec();
            if (!user) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            user.email = tokenData.user.email;
            user.updated_at = ctx.now();
            const metadata = await user.save();
            ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
            const {token, secret} = util.sara_token.issueAuthToken(
                ctx, metadata,
            );
            res
                .status(StatusCodes.CREATED)
                .header("Sara-Issue", token)
                .send({secret});
        },
    );

    r.use("/profile", router);
};
