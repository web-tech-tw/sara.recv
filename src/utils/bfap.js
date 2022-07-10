"use strict";
// Brute-force attack protection.

// Import SHA256 generator
const {sha256} = require("js-sha256");

/**
 * Inspect that is it a attack or not.
 * @param {object} ctx - The context variable from app.js.
 * @param {object} config - The config to use the function.
 * @param {string} target - The target to inspect.
 * @return {boolean}
 */
function inspect(ctx, config, target) {
    const {type, maxRetry, ttl} = config;
    const hash = sha256(target);
    const keyName = `bfap_${type}:${hash}`;
    const status = ctx.cache.get(keyName);
    if (status && status > maxRetry) {
        return true;
    }
    const value = status ? parseInt(status) : 0;
    ctx.cache.set(keyName, value + 1, ttl);
    return false;
}

module.exports = {
    inspect,
};
