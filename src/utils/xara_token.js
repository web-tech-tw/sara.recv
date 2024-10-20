"use strict";
// Token utils of Sara.

// Import config
const {getMust} = require("../config");

// Import createHmac from crypto
const {createHmac} = require("node:crypto");

// Import jsonwebtoken
const {sign, verify} = require("jsonwebtoken");

// Import nanoid
const {nanoid: generateNanoId} = require("nanoid");

// Import const
const {
    APP_NAME: issuerIdentity,
} = require("../init/const");

// Import usePublicKey and usePrivateKey
const {usePublicKey, usePrivateKey} = require("../init/keypair");

// Define hmac function - SHA256
const hmac256hex = (data, key) =>
    createHmac("sha256", key).update(data).digest("hex");

// Define issueOptions
const issueOptions = {
    algorithm: "ES256",
    expiresIn: "1d",
    notBefore: "500ms",
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    noTimestamp: false,
    mutatePayload: false,
};

// Define updateOptions
const updateOptions = {
    algorithm: "ES256",
    noTimestamp: false,
    mutatePayload: false,
};

// Define validateOptions
const validateOptions = {
    algorithms: ["ES256"],
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    complete: true,
};

/**
 * Issue token
 * @module sara_token
 * @function
 * @param {object} userData - The user data to generate the token for.
 * @return {string}
 */
function issue(userData) {
    const user = {
        _id: userData._id,
        email: userData.email,
        nickname: userData.nickname,
        avatar_hash: userData.avatar_hash,
        roles: userData.roles,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
    };

    const privateKey = usePrivateKey();

    const saraTokenId = generateNanoId();
    const saraTokenPayload = {user, sub: user._id, jti: saraTokenId};
    const saraToken = sign(saraTokenPayload, privateKey, issueOptions);

    const guardSecret = getMust("SARA_GUARD_SECRET");
    const guardToken = hmac256hex(saraTokenId, guardSecret);

    return [saraToken, guardToken].join("|");
}

/**
 * Update token
 * @module sara_token
 * @function
 * @param {object} token - The token to update.
 * @param {object} user - The user data to update.
 * @return {string}
 */
function update(token, user) {
    const publicKey = usePublicKey();
    const privateKey = usePrivateKey();

    const [originalSaraToken, guardToken] = token.split("|", 2);
    const {payload: saraTokenPayload} = verify(
        originalSaraToken, publicKey, validateOptions,
    );
    saraTokenPayload.user = {
        ...saraTokenPayload.user,
        ...user,
    };
    const saraToken = sign(
        saraTokenPayload, privateKey, updateOptions,
    );

    return [saraToken, guardToken].join("|");
}

/**
 * Validate token
 * @module sara_token
 * @function
 * @param {string} token - The token to valid.
 * @return {object}
 */
function validate(token) {
    const publicKey = usePublicKey();
    const result = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const [saraToken, guardToken] = token.split("|", 2);
        const {payload} = verify(
            saraToken, publicKey, validateOptions,
        );

        const guardSecret = getMust("SARA_GUARD_SECRET");
        const guardTokenExpected = hmac256hex(payload.jti, guardSecret);
        if (guardToken !== guardTokenExpected) {
            throw new Error("unexpect guard token");
        }

        result.userId = payload.sub;
        result.payload = {
            profile: payload.user,
        };
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}

// Export (object)
module.exports = {
    issue,
    update,
    validate,
};
