"use strict";

const {StatusCodes} = require("http-status-codes");
const {Router: expressRouter} = require("express");

// Import modules
const util = {
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
        middleware.access("admin"),
        middleware.validator.query("user_id").isMongoId().notEmpty(),
        middleware.inspector,
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            res.send(await User.findById(req.query.user_id).exec());
        },
    );

    router.post("/role",
        middleware.access("admin"),
        middleware.validator.body("user_id").isMongoId().notEmpty(),
        middleware.validator.body("role").isString().notEmpty(),
        middleware.inspector,
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            const user = await User.findById(req.body.user_id).exec();
            if (!user) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            if (!Array.isArray(user?.roles)) {
                user.roles = [req.body.role];
            } else if (user.roles.includes(req.body.role)) {
                res.sendStatus(StatusCodes.CONFLICT);
                return;
            } else {
                user.roles.push(req.body.role);
            }
            await util.user.saveData(ctx, user);
            res.sendStatus(StatusCodes.CREATED);
        },
    );

    router.delete("/role",
        middleware.access("admin"),
        middleware.validator.body("user_id").isMongoId().notEmpty(),
        middleware.validator.body("role").isString().notEmpty(),
        middleware.inspector,
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            const user = await User.findById(req.body.user_id).exec();
            if (!user) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
            if (
                Array.isArray(user?.roles) &&
                user.roles.includes(req.body.role)
            ) {
                const index = user.roles.indexOf(req.body.role);
                user.roles.splice(index, 1);
            } else {
                res.sendStatus(StatusCodes.GONE);
                return;
            }
            await util.user.saveData(ctx, user);
            res.sendStatus(StatusCodes.NO_CONTENT);
        },
    );

    r.use("/user", router);
};
