const {StatusCodes} = require("http-status-codes");
const {Router: expressRouter} = require("express");

// Import modules
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
        middleware.access("admin"),
        middleware.validator.query("user_id"),
        middleware.inspector,
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            try {
                res.send(await User.findById(req.query.user_id).exec());
            } catch (e) {
                if (e.kind !== "ObjectId") console.error(e);
                res.sendStatus(StatusCodes.BAD_REQUEST);
            }
        },
    );

    router.post("/role",
        middleware.access("admin"),
        middleware.validator.body("user_id").isString(),
        middleware.validator.body("role").isString(),
        middleware.inspector,
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            let user;
            try {
                user = await User.findById(req.body.user_id).exec();
            } catch (e) {
                if (e.kind !== "ObjectId") console.error(e);
                res.sendStatus(StatusCodes.BAD_REQUEST);
                return;
            }
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
            user.updated_at = ctx.now();
            await user.save();
            ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
            res.sendStatus(StatusCodes.CREATED);
        },
    );

    router.delete("/role",
        middleware.access("admin"),
        middleware.validator.body("user_id").isString(),
        middleware.validator.body("role").isString(),
        middleware.inspector,
        async (req, res) => {
            const User = ctx.database.model("User", schema.user);
            let user;
            try {
                user = await User.findById(req.body.user_id).exec();
            } catch (e) {
                if (e.kind !== "ObjectId") console.error(e);
                res.sendStatus(StatusCodes.BAD_REQUEST);
                return;
            }
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
            user.updated_at = ctx.now();
            await user.save();
            ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
            res.sendStatus(StatusCodes.NO_CONTENT);
        },
    );

    r.use("/user", router);
};
