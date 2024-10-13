"use strict";
// Token utils of Sara.

// Import config
const {getMust} = require("../config");

// Import jsonwebtoken
const {sign, verify} = require("jsonwebtoken");

// Import usePublicKey and usePrivateKey
const {usePublicKey, usePrivateKey} = require("../init/keypair");

// Define Sara Token specs
const issuerIdentity = "Sara Hoshikawa"; // The code of Sara v3

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

// Define validateOptions
const validateOptions = {
    algorithms: ["ES256"],
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    complete: true,
};

/**
 * Issue token
 * @param {object} user - The user data to issue.
 * @return {string}
 */
function issue(user) {
    const privateKey = usePrivateKey();
    const payload = {user, sub: user._id};
    return sign(payload, privateKey, issueOptions);
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
        const {payload} = verify(
            token, publicKey, validateOptions,
        );

        result.userId = payload.sub;
        result.payload = payload;
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}

// Export (object)
module.exports = {
    issue,
    validate,
};
