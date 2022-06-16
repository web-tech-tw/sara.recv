"use strict";
// Token utils of Sara.

// Import jsonwebtoken
const jwt = require("jsonwebtoken");

// Import UUID generator
const {v4: uuidV4} = require("uuid");

// Import SHA256 generator
const {sha256} = require("js-sha256");

// Define generalIssueOptions generator
const generalIssueOptions = (metadata) => ({
    algorithm: "HS256",
    expiresIn: "1d",
    notBefore: "500ms",
    audience: process.env.WEBSITE_URL,
    issuer: sha256(metadata.ctx.jwt_secret),
    noTimestamp: false,
    mutatePayload: false,
    header: {
        sara: {
            version: 1,
            type: metadata.type,
            point: {
                client: {
                    login: process.env.SARA_CLIENT_LOGIN_URL,
                    register: process.env.SARA_CLIENT_REGISTER_URL,
                },
                api: {
                    token: {
                        verify: process.env.SARA_API_TOKEN_VERIFY_URL,
                        decode: process.env.SARA_API_TOKEN_DECODE_URL,
                    },
                },
            },
        },
    },
});

// Define generalValidateOptions generator
const generalValidateOptions = (metadata) => ({
    algorithms: ["HS256"],
    audience: process.env.WEBSITE_URL,
    issuer: sha256(metadata.ctx.jwt_secret),
    complete: true,
});

/**
 *
 * @param {object} ctx the context variable from app.js
 * @param user the user data to issue
 * @return {string|null}
 */
function issueAuthToken(ctx, user) {
    const issueOptions = generalIssueOptions({ctx, type: "auth"});
    const payload = {
        user, sub: user._id || user.email,
        jti: uuidV4(null, null, null),
    };
    return jwt.sign(payload, ctx.jwt_secret, issueOptions, null);
}

/**
 * Issue function (Code)
 * @param {object} ctx the context variable from app.js
 * @param code the code to valid
 * @param user the user data to issue
 * @return {string|null}
 */
function issueCodeToken(ctx, code, user) {
    const nextTokenSecret = `${ctx.jwt_secret}_${code}`;
    const issueOptions = generalIssueOptions({ctx, type: "code"});
    const payload = {
        user, sub: user._id || user.email,
        jti: uuidV4(null, null, null),
    };
    return jwt.sign(payload, nextTokenSecret, issueOptions, null);
}

/**
 * Validate function (Auth)
 * @param {object} ctx the context variable from app.js
 * @param {string} token the token to valid
 * @return {boolean|object}
 */
function validateAuthToken(ctx, token) {
    try {
        const validateOptions = generalValidateOptions({ctx});
        const data = jwt.verify(token, ctx.jwt_secret, validateOptions, null);
        if (
            data?.header?.sara?.version !== 1 ||
            data?.header?.sara?.type !== "auth"
        ) {
            console.error("invalid_sara_code_token");
            return false;
        }
        return data.payload;
    } catch (e) {
        console.error(e);
        return false;
    }
}

/**
 * Validate function (Code)
 * @param {object} ctx the context variable from app.js
 * @param code the code to valid
 * @param {string} token the token to valid
 * @return {boolean|object}
 */
function validateCodeToken(ctx, code, token) {
    try {
        const nextTokenSecret = `${ctx.jwt_secret}_${code}`;
        const validateOptions = generalValidateOptions({ctx});
        const data = jwt.verify(token, nextTokenSecret, validateOptions, null);
        if (
            data?.header?.sara?.version !== 1 ||
            data?.header?.sara?.type !== "code"
        ) {
            console.error("invalid_sara_code_token");
            return false;
        }
        return data.payload;
    } catch (e) {
        console.error(e);
        return false;
    }
}

/**
 * Replay attack protection
 * @param {object} ctx the context variable from app.js
 * @param {object} tokenData the data decoded from token
 * @return {boolean}
 */
function isGone(ctx, tokenData) {
    const keyName = `Token:${tokenData.jti}`;
    if (ctx.cache.has(keyName)) return true;
    ctx.cache.set(keyName, tokenData.iat, tokenData.exp - ctx.now());
    return false;
}

// Export (object)
module.exports = {
    issueAuthToken,
    issueCodeToken,
    validateAuthToken,
    validateCodeToken,
    isGone,
};
