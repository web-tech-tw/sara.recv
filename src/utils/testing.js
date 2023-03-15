"use strict";

const {isProduction} = require("../config");

/**
 * Print message with testing notification.
 * @param {any} messages
 */
function log(...messages) {
    if (isProduction()) return;
    console.info("[!] Test mode:", ...messages);
}

/**
 * Create a helper to merge base URL and path.
 * @param {string} baseUrl - The base URL
 * @return {function(string)}
 */
function urlGlue(baseUrl) {
    return (path) => baseUrl + path;
}

module.exports = {log, urlGlue};
