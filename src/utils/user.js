"use strict";
// User utils

/**
 * Save user data with hooks.
 * @param {object} user - The user to save data.
 * @return {Promise<object>}
 */
async function saveData(user) {
    user.updated_at = Date.now();
    const newUser = await user.save();
    return newUser.toObject();
}

module.exports = {saveData};
