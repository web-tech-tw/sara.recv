"use strict";

require('dotenv').config();

const APP_NAME = 'sara.recv';
const SECRET_FILENAME = 'secret.key';

const fs = require('fs')
const crypto = require('crypto');
const express = require('express');
const http_status = require('http-status-codes');
const email_validator = require('email-validator');

const emailHandler = require('./src/mail');
const tokenHandler = require('./src/token');

const ctx = {}

// JWT Security Check
try {
    ctx.jwt_secret = fs.readFileSync(SECRET_FILENAME).toString();
} catch (e) {
    if (e.code === 'ENOENT') {
        throw 'JWT secret is unset, please generate one with "npm run new-secret"'
    } else {
        console.log(e)
    }
}
if (ctx.jwt_secret.length < 2048) {
    throw 'JWT secret IS NOT SAFE, please generate the new one with "npm run new-secret"';
}
// Check end

ctx.database = require('mongoose')
void (ctx.database.connect(process.env.MONGODB_URI));

const app = express();

app.use(express.urlencoded({extended: true}));

app.get('/', (req, res) => {
    res.send(APP_NAME)
});

app.post('/login', async (req, res) => {
    if (!("email" in req.body)) {
        res.status(http_status.BAD_REQUEST).end();
    } else if (email_validator.validate(req.body.email)) {
        const code = crypto.randomInt(999999);
        emailHandler('login', {
            website: process.env.WEBSITE_URL,
            to: req.body.email,
            ip_address: req.ip,
            code
        }).catch(console.error);
        const next_token = await tokenHandler.issueNextToken(ctx, code, req.body.email);
        res.send({next_token});
    } else {
        res.status(http_status.FORBIDDEN).end();
    }
});

app.post('/login/verify', async (req, res) => {
    if (("code" in req.body) && !("next_token" in req.body)) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const next_token = tokenHandler.validateNextToken(ctx, req.body.code, req.body.next_token);
    if (!next_token) {
        res.status(http_status.FORBIDDEN).end();
        return;
    }
    const token = await tokenHandler.issueAuthToken(ctx, next_token.email);
    res.send({token});
})

app.post('/register', (req, res) => {
    if (!("email" in req.body)) {
        res.status(http_status.BAD_REQUEST).end();
    } else if (email_validator.validate(req.body.email)) {
        res.status(http_status.CREATED).end();
    } else {
        res.status(http_status.FORBIDDEN).end();
    }
});

app.listen(process.env.HTTP_PORT, () => {
    console.log(APP_NAME)
    console.log('====')
    console.log('Application is listening at')
    console.log(`http://localhost:${process.env.HTTP_PORT}`)
});
