"use strict";

const jwt = require('jsonwebtoken');

async function issueAuthToken(ctx, user) {
    return jwt.sign(user, ctx.jwt_secret, null, null);
}

async function issueCodeToken(ctx, code, user) {
    const next_token_secret = `${ctx.jwt_secret}_${code}`;
    return jwt.sign(user, next_token_secret, null, null);
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

module.exports = {
    issueAuthToken,
    issueCodeToken,
    validateAuthToken,
    validateCodeToken,
}
