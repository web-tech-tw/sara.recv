"use strict";

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");

// Import modules
const utilUser = require("../utils/user");

const schemaUser = require("../schemas/user");

const middlewareAccess = require("../middleware/access");
const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");

const database = useDatabase();

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.urlencoded({extended: true}));

router.get("/",
    middlewareAccess("admin"),
    middlewareValidator.query("user_id").isMongoId().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        const User = database.model("User", schemaUser);
        res.send(await User.findById(req.query.user_id).exec());
    },
);

router.post("/role",
    middlewareAccess("admin"),
    middlewareValidator.body("user_id").isMongoId().notEmpty(),
    middlewareValidator.body("role").isString().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        const User = database.model("User", schemaUser);
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
        await utilUser.saveData(user);
        res.sendStatus(StatusCodes.CREATED);
    },
);

router.delete("/role",
    middlewareAccess("admin"),
    middlewareValidator.body("user_id").isMongoId().notEmpty(),
    middlewareValidator.body("role").isString().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        const User = database.model("User", schemaUser);
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
        await utilUser.saveData(user);
        res.sendStatus(StatusCodes.NO_CONTENT);
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/user", router);
};
