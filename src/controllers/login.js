"use strict";

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
        middleware.validator.body("email").isEmail(),
        middleware.inspector,
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            if (!(await User.findOne({email: req.body.email}).exec())) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            const metadata = {email: req.body.email};
            const {token, code} = util.sara_token.issueCodeToken(
                ctx, 6, metadata,
            );
            const data = {
                to: req.body.email,
                website: process.env.WEBSITE_URL,
                ip_address: util.ip_address(req),
                code,
            };
            util.mail_sender(ctx, "login", data).catch(console.error);
            const result = {next_token: token};
            if (ctx.testing) {
                result.code = code;
            }
            res.send(result);
        },
    );

    router.post("/verify",
        middleware.validator.body("code").isNumeric(),
        middleware.validator.body("code").isLength({min: 6, max: 6}),
        middleware.validator.body("next_token").isString(),
        middleware.inspector,
        async (req, res) => {
            const tokenData = util.sara_token.validateCodeToken(
                ctx, req.body.code, req.body.next_token,
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
            const user = await User.findOne({email: tokenData.sub}).exec();
            if (!user) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            const metadata = user.toObject();
            const {token, secret} = util.sara_token.issueAuthToken(
                ctx, metadata,
            );
            res
                .status(StatusCodes.CREATED)
                .header("Sara-Issue", token)
                .send({secret});
        },
    );

    r.use("/login", router);
};
