"use strict";
// Token utils of Sara.

// Import config
const {get, getMust} = require("../config");

// Import createHash from crypto
const {createHash} = require("node:crypto");

// Import jsonwebtoken
const {sign, verify} = require("jsonwebtoken");

// Import useSecret
const {useSecret} = require("../init/secret");

// Define secret
const secret = useSecret();

// Define hash function - SHA256
const sha256hex = (data) =>
    createHash("sha256").update(data).digest("hex");

// Define issueOptions
const issueOptions = {
    algorithm: "HS256",
    expiresIn: "1d",
    notBefore: "500ms",
    audience: getMust("SARA_AUDIENCE_URL"),
    issuer: get("SARA_ISSUER") || sha256hex(secret),
    noTimestamp: false,
    mutatePayload: false,
    header: {
        sara: {
            version: 2,
            type: "auth",
        },
    },
};

// Define validateOptions
const validateOptions = {
    algorithms: ["HS256"],
    issuer: get("SARA_ISSUER") || sha256hex(secret),
    audience: getMust("SARA_AUDIENCE_URL"),
    complete: true,
};

/**
 * Issue token
 * @param {object} user - The user data to issue.
 * @return {string}
 */
function issue(user) {
    const payload = {user, sub: user._id};
    return sign(payload, secret, issueOptions);
}

/**
 * Validate token
 * @module sara_token
 * @function
 * @param {string} token - The token to valid.
 * @return {object}
 */
function validate(token) {
    const result = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const {header, payload} = verify(token, secret, validateOptions);

        if (
            header?.sara?.version !== 2 ||
            header?.sara?.type !== "auth"
        ) {
            throw new Error("invalid sara token type");
        }

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
