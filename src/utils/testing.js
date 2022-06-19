"use strict";

/**
 * Print message with testing notification
 * @param {any} messages
 */
function log(...messages) {
    console.log("[!] Test mode:", ...messages);
}

module.exports = {log};
