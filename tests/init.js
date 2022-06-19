"use strict";

// Load configs from .env
require("dotenv").config();

// Import modules
const ctx = {
    testing: true,
    now: () => Math.floor(new Date().getTime() / 1000),
    cache: require("../src/init/cache"),
    database: require("../src/init/database"),
    jwt_secret: require("../src/init/jwt_secret"),
};

// Initialize application
const app = require("../src/init/express")(ctx);

// Map routes
require("../src/controllers/index")(ctx, app);

// Export (object)
module.exports = {app, ctx};
