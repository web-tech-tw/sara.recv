"use strict";

const {generateRandomCode} = require("./native");
const {nanoid: generateNanoId} = require("nanoid");

const {useCache} = require("../init/cache");

const cache = useCache();

const getSessionCodeName = (sessionId, code) => `${sessionId}@${code}`;

/**
 * Create a code session with data.
 * @param {any} sessionData the data
 * @param {number} codeLength length of the code
 * @param {number} ttl the time to live in seconds
 * @return {object}
 */
function createOne(sessionData, codeLength, ttl) {
    const sessionId = generateNanoId();
    const code = generateRandomCode(codeLength);
    const sessionCodeName = getSessionCodeName(sessionId, code);
    cache.set(sessionCodeName, sessionData, ttl);
    return {code, sessionId};
}

/**
 * Delete the code session
 * @param {string} sessionId the session ID
 * @param {string} code the code
 * @return {bool}
 */
function deleteOne(sessionId, code) {
    const sessionCodeName = getSessionCodeName(sessionId, code);
    if (!cache.has(sessionCodeName)) {
        return false;
    }
    cache.del(sessionCodeName);
    return true;
}

/**
 * Get data of the code session
 * @param {string} sessionId the session ID
 * @param {string} code the code
 * @return {any|null}
 */
function getOne(sessionId, code) {
    const sessionCodeName = getSessionCodeName(sessionId, code);
    if (!cache.has(sessionCodeName)) {
        return null;
    }
    return cache.get(sessionCodeName);
}

module.exports = {
    createOne,
    deleteOne,
    getOne,
};
