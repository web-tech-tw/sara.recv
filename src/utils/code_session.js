"use strict";

const {generateRandomCode} = require("./native");
const {nanoid: generateNanoId} = require("nanoid");

const {useCache} = require("../init/cache");

const cache = useCache();

const getSessionCodeName =
    (type, sessionId, code) =>
        `code:${type}:${sessionId}@${code}`;

/**
 * Create a code session with data.
 * @param {string} type the type of the session
 * @param {any} metadata the data
 * @param {number} codeLength length of the code
 * @param {number} ttl the time to live in seconds
 * @return {object}
 */
function createOne(type, metadata, codeLength, ttl) {
    const sessionId = generateNanoId();
    const code = generateRandomCode(codeLength);
    const sessionCodeName = getSessionCodeName(
        type, sessionId, code,
    );

    cache.set(sessionCodeName, metadata, ttl);
    const deleteIt = () => {
        cache.del(sessionCodeName);
    };

    return {
        code,
        sessionId,
        deleteIt,
    };
}

/**
 * Get data of the code session
 * @param {string} type the type of the session
 * @param {string} sessionId the session ID
 * @param {string} code the code
 * @return {object|null}
 */
function getOne(type, sessionId, code) {
    const sessionCodeName = getSessionCodeName(
        type, sessionId, code,
    );
    if (!cache.has(sessionCodeName)) {
        return null;
    }

    const metadata = cache.get(sessionCodeName);
    const deleteIt = () => {
        cache.del(sessionCodeName);
    };

    return {
        ...metadata,
        deleteIt,
    };
}

module.exports = {
    createOne,
    getOne,
};
