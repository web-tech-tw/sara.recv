"use strict";
// The simple toolbox for Node.js

const crypto = require("node:crypto");

/**
 * Get POSIX Timestamp (second)
 * @module native
 * @function
 * @return {number}
 */
function getPosixTimestamp() {
    return Math.floor(new Date().getTime() / 1000);
}

/**
 * Shortcut for hasOwnProperty with safe.
 * @module native
 * @function
 * @param {object} srcObject
 * @param {string} propName
 * @return {boolean}
 */
function isObjectPropExists(srcObject, propName) {
    return Object.prototype.hasOwnProperty.call(srcObject, propName);
}

/**
 * Generate random code with length.
 * @param {number} length length of code
 * @return {string}
 */
function generateRandomCode(length) {
    const maxValue = (10 ** length) - 1;
    return crypto.
        randomInt(0, maxValue).
        toString().
        padStart(length, "0");
}

// Export (object)
module.exports = {
    getPosixTimestamp,
    isObjectPropExists,
    generateRandomCode,
};
