"use strict";
// Token utils of Sara.

// Import config
const {get, getMust} = require("../config");

// Import createHash from crypto
const {createHash} = require("node:crypto");

// Import jsonwebtoken
const {sign, verify} = require("jsonwebtoken");

// Import useJwtSecret
const {useJwtSecret} = require("../init/jwt_secret");

// Define jwtSecret
const jwtSecret = useJwtSecret();

// Define hash function - SHA256
const sha256hex = (data) =>
    createHash("sha256").update(data).digest("hex");

// Define issueOptions
const issueOptions = {
    algorithm: "HS256",
    expiresIn: "1d",
    notBefore: "500ms",
    audience: getMust("SARA_AUDIENCE_URL"),
    issuer: get("SARA_ISSUER") || sha256hex(jwtSecret),
    noTimestamp: false,
    mutatePayload: false,
    header: {
        sara: {
            version: 1,
            type: "auth",
            point: {
                client: {
                    login: getMust("SARA_CLIENT_LOGIN_URL"),
                    register: getMust("SARA_CLIENT_REGISTER_URL"),
                },
                api: {
                    token: {
                        verify: getMust("SARA_API_TOKEN_VERIFY_URL"),
                        decode: getMust("SARA_API_TOKEN_DECODE_URL"),
                    },
                },
            },
        },
    },
};

// Define validateOptions
const validateOptions = {
    algorithms: ["HS256"],
    issuer: get("SARA_ISSUER") || sha256hex(jwtSecret),
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
    return sign(payload, jwtSecret, issueOptions);
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
        const {header, payload} = verify(token, jwtSecret, validateOptions);

        if (
            header?.sara?.version !== 1 ||
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
