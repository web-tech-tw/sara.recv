"use strict";

const constant = require("../init/const");

const {isProduction} = require("../config");

/**
 * Check if the address has testing suffix.
 * @param {string} addr the address
 * @return {bool}
 */
function isTestMailAddress(addr) {
    return addr.endsWith("@" + constant.TEST_EMAIL_DOMAIN);
}

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

module.exports = {
    log,
    urlGlue,
    isTestMailAddress,
};
