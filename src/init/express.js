"use strict";
// express.js is a web framework.

// Import StatusCodes
const { StatusCodes } = require("http-status-codes");

// Import express.js
const express = require("express");

// Export (function)
module.exports = (ctx) => {
    // Initialize app engine
    const app = express();

    // General middlewares
    app.use(require("request-ip").mw());
    app.use(require("../middlewares/auth")(ctx));

    // Request body parser
    app.use(express.urlencoded({extended: true}));

    // Optional middlewares
    if (process.env.HTTPS_REDIRECT === "yes") {
        app.use(require("../middlewares/https_redirect"));
    }
    if (process.env.HTTP_CORS === "yes") {
        // Check header "Origin"
        app.use((req, res, next) => {
            const originUrl = req.header('Origin');
            if (originUrl !== process.env.WEBSITE_URL) {
                res.sendStatus(StatusCodes.FORBIDDEN);
                return;
            }
            next();
        })
        // Do CORS handler
        const cors = require("cors");
        const corsHandler = cors({
            origin: process.env.WEBSITE_URL,
            exposedHeaders: ["Sara-Issue", "Sara-Code"],
        });
        app.use(corsHandler);
    }

    // Return app engine
    return app;
};
