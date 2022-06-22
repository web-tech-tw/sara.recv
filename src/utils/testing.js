"use strict";

/**
 * Print message with testing notification.
 * @param {any} messages
 */
function log(...messages) {
    if (process.env.NODE_ENV !== "development") return;
    console.log("[!] Test mode:", ...messages);
}

module.exports = {log};
