"use strict";

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

// Import modules
const utilSaraToken = require("../utils/sara_token");

const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.post("/verify",
    middlewareValidator.body("token").isString().notEmpty(),
    middlewareInspector,
    (req, res) => {
        const data = utilSaraToken.validateAuthToken(req.body.token);
        res.sendStatus(data ? StatusCodes.OK : StatusCodes.UNAUTHORIZED);
    },
);

router.post("/decode",
    middlewareValidator.body("token").isString().notEmpty(),
    middlewareInspector,
    (req, res) => {
        const data = utilSaraToken.validateAuthToken(req.body.token);
        res.status(data ?
            StatusCodes.OK :
            StatusCodes.UNAUTHORIZED,
        ).send(data);
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/token", router);
};
