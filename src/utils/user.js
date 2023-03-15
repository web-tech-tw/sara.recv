"use strict";
// User utils

const {useCache} = require("../init/cache");
const {getPosixTimestamp} = require("../utils/native");

const cache = useCache();

/**
 * Save user data with hooks.
 * @param {object} user - The user to save data.
 * @return {Promise<object>}
 */
async function saveData(user) {
    user.updated_at = getPosixTimestamp();
    const metadata = await user.save();
    const cacheKeyName = `TokenU:${user._id}`;
    cache.set(cacheKeyName, user.updated_at, 3600);
    return metadata;
}

module.exports = {saveData};
