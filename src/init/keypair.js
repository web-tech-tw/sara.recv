"use strict";
// Check the "secret.key" whether safe or not.

// Import fs
const {readFileSync} = require("node:fs");

// Import constant
const constants = require("./const");

// Export as useFunction
exports.usePublicKey = () =>
    readFileSync(constants.PUBLIC_KEY_FILENAME);
exports.usePrivateKey = () =>
    readFileSync(constants.PRIVATE_KEY_FILENAME);
