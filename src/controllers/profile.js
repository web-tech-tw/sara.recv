"use strict";

const {StatusCodes} = require("http-status-codes");
const {Router: expressRouter} = require("express");

// Import modules
const util = {
    mail_sender: require("../utils/mail_sender"),
    sara_token: require("../utils/sara_token"),
    ip_address: require("../utils/ip_address"),
    user: require("../utils/user"),
};
const schema = {
    user: require("../schemas/user"),
};
const middleware = {
    access: require("../middleware/access"),
    inspector: require("../middleware/inspector"),
    validator: require("express-validator"),
};

// Export routes mapper (function)
module.exports = (ctx, r) => {
    const router = expressRouter();

    router.get("/",
        middleware.access(null),
        async (req, res) => {
            res.send({profile: req.auth.metadata.user});
        },
    );

    router.put("/",
        middleware.access(null),
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            const user = await User.findById(req.auth.id).exec();
            if (!user) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            user.nickname =
                req?.body?.nickname ||
                req.auth.metadata.user.nickname;
            const metadata = await util.user.saveData(ctx, user);
            const {token, secret} = util.sara_token.issueAuthToken(
                ctx, metadata,
            );
            res
                .header("Sara-Issue", token)
                .header("Sara-Code", secret)
                .sendStatus(StatusCodes.CREATED);
        },
    );

    router.put("/email",
        middleware.access(null),
        middleware.validator.body("email").isEmail().notEmpty(),
        middleware.inspector,
        async (req, res) => {
            const metadata = {
                _id: req.auth.id,
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
            util.mail_sender(ctx, "update_email", data).catch(console.error);
            const User = ctx.database.model("User", schema.user);
            if (await User.findOne({email: req.body.email}).exec()) {
                res.sendStatus(StatusCodes.CONFLICT);
                return;
            }
            res.send({update_email_token: token});
        },
    );

    router.post("/email/verify",
        middleware.access(null),
        middleware.validator.body("code").isNumeric().notEmpty(),
        middleware.validator.body("code").isLength({min: 8, max: 8}).notEmpty(),
        middleware.validator.body("update_email_token").isString().notEmpty(),
        middleware.inspector,
        async (req, res) => {
            const tokenData = util.sara_token.validateCodeToken(
                ctx, req.body.code, req.body.update_email_token,
            );
            if ((!tokenData) || (tokenData.sub !== req.auth.id)) {
                res.sendStatus(StatusCodes.UNAUTHORIZED);
                return;
            }
            if (util.sara_token.isGone(ctx, tokenData)) {
                res.sendStatus(StatusCodes.GONE);
                return;
            }
            const User = ctx.database.model("User", schema.user);
            const user = await User.findById(req.auth.id).exec();
            if (!user) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            user.email = tokenData.data.email;
            const metadata = util.user.saveData(ctx, user);
            const {token, secret} = util.sara_token.issueAuthToken(
                ctx, metadata,
            );
            res
                .header("Sara-Issue", token)
                .header("Sara-Code", secret)
                .sendStatus(StatusCodes.CREATED);
        },
    );

    r.use("/profile", router);
};
