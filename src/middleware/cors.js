"use strict";
// Cross-Origin Resource Sharing

// Import config
const {getEnabled, getMust} = require("../config");

// Import cors
const cors = require("cors");

// Import const
const {
    HEADER_REFRESH_TOKEN: headerRefreshToken,
} = require("../init/const");

// Read config
const corsOrigin = getMust("CORS_ORIGIN");
const swaggerCorsOrigin = getMust("SWAGGER_CORS_ORIGIN");

// Export (function)
module.exports = cors({
    origin: getEnabled("ENABLED_SWAGGER") ?
        [corsOrigin, swaggerCorsOrigin]:
        corsOrigin,
    exposedHeaders: [headerRefreshToken],
});
