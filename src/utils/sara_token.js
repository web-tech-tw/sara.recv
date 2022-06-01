"use strict";
// Token utils of Sara.

// Import jsonwebtoken
const jwt = require('jsonwebtoken');

// Import UUID Generator
const {v4: uuidV4} = require('uuid');

// Import SHA256 Generator
const {sha256} = require('js-sha256');

// Define general_issue_options Generator
const general_issue_options = (ctx, metadata) => ({
    algorithm: "HS256",
    expiresIn: "1d",
    notBefore: "500ms",
    audience: process.env.WEBSITE_URL,
    issuer: sha256(ctx.jwt_secret),
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
                    sub_verify: process.env.SARA_API_SUB_VERIFY_URL,
                    role_verify: process.env.SARA_API_ROLE_VERIFY_URL
                }
            }
        }
    }
});

// Issue Function (Auth)
function issueAuthToken(ctx, user) {
    const issue_options = general_issue_options(ctx, {type: "auth"});
    const payload = {user, sub: user._id || user.email, jti: uuidV4(null, null, null)};
    return jwt.sign(payload, ctx.jwt_secret, issue_options, null);
}

// Issue Function (Code)
function issueCodeToken(ctx, code, user) {
    const next_token_secret = `${ctx.jwt_secret}_${code}`;
    const issue_options = general_issue_options(ctx, {type: "code"});
    const payload = {user, sub: user._id || user.email, jti: uuidV4(null, null, null)};
    return jwt.sign(payload, next_token_secret, issue_options, null);
}

// Validate Function (Auth)
function validateAuthToken(ctx, token) {
    try {
        return jwt.verify(token, ctx.jwt_secret, null, null);
    } catch (e) {
        console.error(e);
        return false;
    }
}

// Validate Function (Code)
function validateCodeToken(ctx, code, token) {
    try {
        const next_token_secret = `${ctx.jwt_secret}_${code}`;
        return jwt.verify(token, next_token_secret, null, null);
    } catch (e) {
        console.error(e);
        return false;
    }
}

// Replay Attack Protection
function isGone(ctx, token_data) {
    const key_name = `Token:${token_data.jti}`;
    if (ctx.cache.has(key_name)) return true;
    ctx.cache.set(key_name, token_data.iat, token_data.exp - ctx.now());
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
