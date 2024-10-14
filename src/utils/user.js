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
    const newUser = await user.save();
    return newUser.toObject();
}

module.exports = {saveData};
