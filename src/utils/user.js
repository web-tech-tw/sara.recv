"use strict";
// User utils

/**
 * Save user data with hooks.
 * @param {object} ctx - The context variable from app.js.
 * @param {object} user - The user to save data.
 * @return {Promise<object>}
 */
async function saveData(ctx, user) {
    user.updated_at = ctx.now();
    const metadata = await user.save();
    const cacheKeyName = `TokenU:${user._id}`;
    ctx.cache.set(
        cacheKeyName,
        user.updated_at,
        3600,
    );
    return metadata;
}

module.exports = {saveData};
