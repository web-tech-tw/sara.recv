"use strict";

const {isProduction} = require("../../src/config");

const {nanoid: generateNanoId} = require("nanoid");
const request = require("supertest");

const {StatusCodes} = require("http-status-codes");

const {useApp} = require("../../src/init/express");
const {useCache} = require("../../src/init/cache");

/**
 * Generate fake user of the testing session.
 * @return {object}
 */
function generateFakeUser() {
    const sessionCode = `testing_${generateNanoId()}`;

    return {
        nickname: `Sara Hoshikawa - ${sessionCode}`,
        email: `sara_${sessionCode}@web-tech.github.io`,
    };
}

/**
 * Do register, no matter if the user already exists
 * @param {object} userData the user
 * @return {Promise<bool>}
 */
async function registerFakeUser(userData) {
    const app = useApp();
    const cache = useCache();

    const verifyResponse = await request(app)
        .post("/register")
        .send(userData)
        .type("form")
        .expect(StatusCodes.CREATED);

    const {session_id: sessionCode} = verifyResponse.body;
    const statusResponse = await request(app)
        .post("/register/verify")
        .send({
            session_id: sessionCode,
            code: cache.take("_testing_code"),
        })
        .type("form")
        .expect(StatusCodes.CREATED);

    return statusResponse.status === StatusCodes.CREATED;
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
    generateFakeUser,
    registerFakeUser,
    log,
    urlGlue,
};
