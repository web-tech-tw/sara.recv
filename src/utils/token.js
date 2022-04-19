"use strict";

const jwt = require('jsonwebtoken');
const {v4: uuidV4} = require('uuid');

const constant = require('../init/const');

const general_issue_options = () => ({
    algorithm: "HS256",
    expiresIn: "7d",
    notBefore: "500ms",
    audience: process.env.WEBSITE_URL,
    issuer: constant.APP_NAME,
    noTimestamp: false,
    mutatePayload: false,
});

function issueAuthToken(ctx, user) {
    const payload = {user, sub: user._id || user.email, jti: uuidV4(null, null, null)};
    return jwt.sign(payload, ctx.jwt_secret, general_issue_options(), null);
}

function issueCodeToken(ctx, code, user) {
    const next_token_secret = `${ctx.jwt_secret}_${code}`;
    const payload = {user, sub: user._id || user.email, jti: uuidV4(null, null, null)};
    return jwt.sign(payload, next_token_secret, general_issue_options(), null);
}

function validateAuthToken(ctx, token) {
    try {
        return jwt.verify(token, ctx.jwt_secret, null, null);
    } catch (e) {
        console.error(e);
        return false;
    }
}

function validateCodeToken(ctx, code, token) {
    try {
        const next_token_secret = `${ctx.jwt_secret}_${code}`;
        return jwt.verify(token, next_token_secret, null, null);
    } catch (e) {
        console.error(e);
        return false;
    }
}

function isGone(ctx, token_data) {
    if (ctx.cache.has(token_data.jti)) {
        return true;
    }
    ctx.cache.set(token_data.jti, token_data.iat, token_data.exp - ctx.now());
    return false;
}

module.exports = {
    issueAuthToken,
    issueCodeToken,
    validateAuthToken,
    validateCodeToken,
    isGone,
};
