"use strict";

const jwt = require('jsonwebtoken');
const user_schema = require('./models/user');

async function issueToken(ctx, email) {
    const user = ctx.database.model('User', user_schema);
    if (await user.find({email}).exec()) {
        return jwt.sign(user, ctx.jwt_secret, null, null);
    } else {
        return null;
    }
}

function issueNextToken(ctx, email, code) {
    const next_token_secret = `${ctx.jwt_secret}_${code}`;
    return jwt.sign({email}, next_token_secret, null, null);
}

function validate(_, token) {
    try {
        return jwt.verify(token, ctx.jwt_secret, null, null);
    } catch (e) {
        console.error(e);
        return false;
    }
}

module.exports = {issueToken, issueNextToken, validate}
