"use strict";
// Check the header "Origin" in request is equal to CORS_ORIGIN,
// if not, interrupt it.

// Import config
const {getMust} = require("../config");

// Import getUserAgent
const {getUserAgent} = require("../utils/visitor");

// Import StatusCodes
const {StatusCodes} = require("http-status-codes");

// Export (function)
module.exports = (req, res, next) => {
    const userAgent = getUserAgent(req);
    if (userAgent === "sara_client/2.0") {
        next();
        return;
    }

    const originUrl = req.header("Origin");
    if (originUrl === getMust("CORS_ORIGIN")) {
        next();
        return;
    }

    res.sendStatus(StatusCodes.FORBIDDEN);
    return;
};
