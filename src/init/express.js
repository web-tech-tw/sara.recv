"use strict";
// express.js is a web framework.

// Import express.js
const express = require("express");

// Export (function)
module.exports = (ctx) => {
    // Initialize app engine
    const app = express();

    // General middleware
    app.use(require("request-ip").mw());
    app.use(require("../middleware/auth")(ctx));

    // Request body parser
    app.use(express.urlencoded({extended: true}));

    // Optional middleware
    if (process.env.HTTPS_REDIRECT === "yes") {
        app.use(require("../middleware/https_redirect"));
    }
    if (process.env.HTTP_CORS === "yes") {
        // Check header "Origin"
        app.use(require("../middleware/cors_origin"));
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
