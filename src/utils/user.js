"use strict";
// User utils

const {getPosixTimestamp} = require("../utils/native");

/**
 * Save user data with hooks.
 * @param {object} user - The user to save data.
 * @return {Promise<object>}
 */
async function saveData(user) {
    user.updated_at = getPosixTimestamp();
    return await user.save();
}

module.exports = {saveData};
