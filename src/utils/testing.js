"use strict";

/**
 * Print message with testing notification.
 * @param {any} messages
 */
function log(...messages) {
    if (process.env.NODE_ENV !== "development") return;
    console.log("[!] Test mode:", ...messages);
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
