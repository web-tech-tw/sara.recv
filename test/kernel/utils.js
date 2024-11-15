"use strict";

const {
    USER_AGENT: userAgent,
} = require("./init");

const {isProduction} = require("../../src/config");

const {nanoid: generateNanoId} = require("nanoid");
const request = require("supertest");

const {StatusCodes} = require("http-status-codes");

const {useApp} = require("../../src/init/express");
const {useCache} = require("../../src/init/cache");

/**
 * Print message with testing notification.
 * @param {any} messages
 */
function print(...messages) {
    if (isProduction()) return;
    const timestamp = new Date().toString();
    console.info(
        "---\n",
        "[!] *Test Message*\n",
        `[!] ${timestamp}\n`,
        ...messages,
    );
}

/**
 * Create a helper to merge base URL and path.
 * @param {string} baseUrl - The base URL
 * @return {function(string)}
 */
function urlGlue(baseUrl) {
    return (path) => baseUrl + path;
}

/**
 * Return a function to run a task with arguments.
 * @param {function} task
 * @return {any}
 */
function toTest(task, ...args) {
    return async function() {
        try {
            await task(...args);
        } catch (error) {
            console.error(error);
            throw error;
        }
    };
}

/**
 * Run prepare handlers.
 * @param {function[]} handlers
 * @return {function}
 */
function toPrepare(...handlers) {
    return async function() {
        try {
            const promises = handlers.map((c) => c());
            await Promise.all(promises);
        } catch (error) {
            console.error(error);
            throw error;
        }
    };
}

/**
 * Generate fake user of the testing session.
 * @return {object}
 */
function generateFakeUser() {
    const userSerial = generateNanoId();
    const userId = `testing_${userSerial}`;

    const nickname = `Fake User - ${userId}`;
    const email = `fake_user_${userId}@web-tech-tw.github.io`;

    return {nickname, email};
}

/**
 * Do register, no matter if the user already exists
 * @param {object} userData the user
 * @return {Promise<bool>}
 */
async function registerFakeUser(userData) {
    const app = useApp();
    const cache = useCache();

    const verifyResponse = await request(app).
        post("/users").
        set("user-agent", userAgent).
        type("json").
        send(userData).
        expect(StatusCodes.CREATED).
        expect("content-type", /json/);

    const {session_id: sessionId} = verifyResponse.body;
    const sessionCode = cache.take("_testing_code");

    const statusResponse = await request(app).
        patch("/users").
        set("user-agent", userAgent).
        type("json").
        send({
            session_id: sessionId,
            code: sessionCode,
        }).
        expect(StatusCodes.CREATED).
        expect("content-type", /plain/);

    return statusResponse.status === StatusCodes.CREATED;
}

module.exports = {
    print,
    urlGlue,
    toTest,
    toPrepare,
    generateFakeUser,
    registerFakeUser,
};
