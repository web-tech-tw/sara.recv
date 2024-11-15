"use strict";
// Token utils for testing/debugging or developing.

// Import config
const {isProduction} = require("../config");

const DEFAULT_FAKE_USER = {
    _id: "67345206787c5d2b9be61c37",
    nickname: "The Fake User",
    email: "the_fake_user@web-tech-tw.github.io",
    avatar_hash: "fake_user",
    roles: [],
};

/**
 * Returns a new user profile
 * @module test_token
 * @function
 * @return {object}
 */
function newProfile() {
    return structuredClone(DEFAULT_FAKE_USER);
}

/**
 * Issue token
 * @module test_token
 * @function
 * @param {object} userData - The user data to generate the token for.
 * @return {string}
 */
function issue(userData) {
    if (isProduction()) {
        throw new Error("test_token is not allowed in production");
    }

    userData = userData || DEFAULT_FAKE_USER;

    const user = {
        _id: userData._id,
        email: userData.email,
        nickname: userData.nickname,
        avatar_hash: userData.avatar_hash,
        roles: userData.roles,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
    };

    const userJson = JSON.stringify(user);
    return Buffer.
        from(userJson, "utf-8").
        toString("base64");
}

/**
 * Validate token
 * @module test_token
 * @function
 * @param {string} token - The token to valid.
 * @return {object}
 */
function validate(token) {
    if (isProduction()) {
        throw new Error("test_token is not allowed in production");
    }

    const result = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const profile = JSON.parse(
            Buffer.
                from(token, "base64").
                toString("utf-8"),
        );

        result.userId = profile._id;
        result.payload = {
            profile,
        };
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}

// Export (object)
module.exports = {
    newProfile,
    issue,
    validate,
};
