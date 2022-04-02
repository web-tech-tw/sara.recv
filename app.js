"use strict";

require('dotenv').config();

const
    crypto = require('crypto'),
    http_status = require('http-status-codes'),
    email_validator = require('email-validator');

const user_schema = require("./src/schemas/user");

const
    app = require('./src/init/express'),
    constant = require('./src/init/const'),
    ctx = {
        database: require('./src/init/database'),
        jwt_secret: require('./src/init/security')
    },
    util = {
        email: require('./src/utils/mail'),
        token: require('./src/utils/token')
    }

app.get('/', (req, res) => {
    res.send(constant.APP_NAME)
});

app.post('/login', async (req, res) => {
    if (!("email" in req.body)) {
        res.status(http_status.BAD_REQUEST).end();
    } else if (email_validator.validate(req.body.email)) {
        const code = crypto.randomInt(100000, 999999);
        const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: req.ip, code};
        util.email('login', data).catch(console.error);
        const User = ctx.database.model('User', user_schema);
        if (!(await User.findOne({email: req.body.email}).exec())) return null;
        const next_token = await util.token.issueCodeToken(ctx, code, {email: req.body.email});
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
    const next_token = util.token.validateCodeToken(ctx, req.body.code, req.body.next_token);
    if (!next_token) {
        res.status(http_status.FORBIDDEN).end();
        return;
    }
    const User = ctx.database.model('User', user_schema);
    if (!(await User.findOne({email: req.body.email}).exec())) return null;
    const token = await util.token.issueAuthToken(ctx, {email: req.body.email});
    res.send({token});
})

app.post('/register', async (req, res) => {
    if (!("email" in req.body)) {
        res.status(http_status.BAD_REQUEST).end();
    } else if (email_validator.validate(req.body.email)) {
        const code = crypto.randomInt(1000000, 9999999);
        const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: req.ip, code};
        util.email('register', data).catch(console.error);
        const User = ctx.database.model('User', user_schema);
        if (await User.findOne({email: req.body.email}).exec()) return null;
        const register_token = await util.token.issueCodeToken(ctx, code, {email: req.body.email});
        res.send({register_token});
    } else {
        res.status(http_status.FORBIDDEN).end();
    }
});

app.post('/register/verify', async (req, res) => {
    if (("code" in req.body) && !("register_token" in req.body)) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const register_token = util.token.validateCodeToken(ctx, req.body.code, req.body.register_token);
    if (!register_token) {
        res.status(http_status.FORBIDDEN).end();
        return;
    }
    const User = ctx.database.model('User', user_schema);
    if (await User.findOne({email: register_token.email}).exec()) return null;
    const user = await (new User(register_token)).save();
    const token = await util.token.issueAuthToken(ctx, user);
    res.send({token});
})

app.listen(process.env.HTTP_PORT, () => {
    console.log(constant.APP_NAME)
    console.log('====')
    console.log('Application is listening at')
    console.log(`http://localhost:${process.env.HTTP_PORT}`)
});
