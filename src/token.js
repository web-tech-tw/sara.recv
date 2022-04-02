"use strict";

const jwt = require('jsonwebtoken');
const user_schema = require('./models/user');

async function issueAuthToken(ctx, email) {
    const user_model = ctx.database.model('User', user_schema);
    const user = await user_model.findOne({email}).exec()
    if (!user) return null;
    return jwt.sign(user, ctx.jwt_secret, null, null);
}

async function issueNextToken(ctx, code, email) {
    const user_model = ctx.database.model('User', user_schema);
    const user = await user_model.findOne({email}).exec()
    if (!user) return null;
    const next_token_secret = `${ctx.jwt_secret}_${code}`;
    return jwt.sign(user, next_token_secret, null, null);
}

async function issueRegisterToken(ctx, code, email) {
    const user_model = ctx.database.model('User', user_schema);
    const user = await user_model.findOne({email}).exec()
    if (user) return null;
    const next_token_secret = `${ctx.jwt_secret}_${code}`;
    return jwt.sign({email}, next_token_secret, null, null);
}

function validateAuthToken(ctx, token) {
    try {
        return jwt.verify(token, ctx.jwt_secret, null, null);
    } catch (e) {
        console.error(e);
        return false;
    }
}

function validateNextToken(ctx, code, token) {
    try {
        const next_token_secret = `${ctx.jwt_secret}_${code}`;
        return jwt.verify(token, next_token_secret, null, null);
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function validateRegisterToken(ctx, code, token) {
    try {
        const next_token_secret = `${ctx.jwt_secret}_${code}`;
        const status = jwt.verify(token, next_token_secret, null, null);
        if (!status) return false;
        const user_model = ctx.database.model('User', user_schema);
        const user = await user_model.findOne({email: status.email}).exec()
        if (user) return null;
        return status;
    } catch (e) {
        console.error(e);
        return false;
    }
}

module.exports = {
    issueAuthToken,
    issueNextToken,
    issueRegisterToken,
    validateAuthToken,
    validateNextToken,
    validateRegisterToken
}
