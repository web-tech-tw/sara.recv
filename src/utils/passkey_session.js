"use strict";

const {nanoid: generateNanoId} = require("nanoid");

const {useCache} = require("../init/cache");

const cache = useCache();

const getSessionCodeName =
    (type, sessionId) => `passkey:${type}:${sessionId}`;

/**
 * Create a passkey session with data.
 * @param {string} type the type of the session
 * @param {any} metadata the data
 * @param {number} ttl the time to live in seconds
 * @return {object}
 */
function createOne(type, metadata, ttl) {
    const sessionId = generateNanoId();
    const sessionCodeName = getSessionCodeName(type, sessionId);

    cache.set(sessionCodeName, metadata, ttl);
    const deleteIt = () => {
        cache.del(sessionCodeName);
    };

    return {
        sessionId,
        deleteIt,
    };
}

/**
 * Get data of the passkey session
 * @param {string} type the type of the session
 * @param {string} sessionId the session ID
 * @return {object|null}
 */
function getOne(type, sessionId) {
    const sessionCodeName = getSessionCodeName(type, sessionId);
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
