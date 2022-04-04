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
        cache: require('./src/init/cache'),
        database: require('./src/init/database'),
        jwt_secret: require('./src/init/security')
    },
    util = {
        now: () => new Date().getTime(),
        email: require('./src/utils/mail'),
        token: require('./src/utils/token')
    };

app.get('/', (req, res) => {
    res.redirect(http_status.MOVED_PERMANENTLY, process.env.WEBSITE_URL);
});

app.post('/login', async (req, res) => {
    if (!("email" in req.body && email_validator.validate(req.body.email))) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const User = ctx.database.model('User', user_schema);
    if (!(await User.findOne({email: req.body.email}).exec())) {
        res.status(http_status.NOT_FOUND).end();
        return;
    }
    const code = crypto.randomInt(100000, 999999);
    const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: req.ip, code};
    util.email('login', data).catch(console.error);
    const metadata = {email: req.body.email};
    const next_token = await util.token.issueCodeToken(ctx, code, metadata);
    res.send({next_token});
});

app.post('/login/verify', async (req, res) => {
    if (!("code" in req.body && "next_token" in req.body && req.body.code.length === 6)) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const next_token_data = util.token.validateCodeToken(ctx, req.body.code, req.body.next_token);
    if (!next_token_data) {
        res.status(http_status.UNAUTHORIZED).end();
        return;
    }
    if (ctx.cache.has(next_token_data.jti)) {
        res.sendStatus(http_status.GONE);
        return;
    } else {
        ctx.cache.set(next_token_data.jti, next_token_data, next_token_data.exp - util.now());
    }
    const User = ctx.database.model('User', user_schema);
    const user = await User.findOne({email: next_token_data.sub}).exec();
    if (!user) {
        res.status(http_status.NOT_FOUND).end();
        return;
    }
    const metadata = user.toObject();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.post('/register', async (req, res) => {
    if (!(("nickname" in req.body && "email" in req.body && email_validator.validate(req.body.email)))) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const code = crypto.randomInt(1000000, 9999999);
    const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: req.ip, code};
    util.email('register', data).catch(console.error);
    const User = ctx.database.model('User', user_schema);
    if (await User.findOne({email: req.body.email}).exec()) {
        res.status(http_status.CONFLICT).end();
        return;
    }
    const metadata = {nickname: req.body.nickname, email: req.body.email};
    const register_token = await util.token.issueCodeToken(ctx, code, metadata);
    res.send({register_token});
});

app.post('/register/verify', async (req, res) => {
    if (!("code" in req.body && "register_token" in req.body && req.body.code.length === 7)) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const register_token_data = util.token.validateCodeToken(ctx, req.body.code, req.body.register_token);
    if (!register_token_data) {
        res.status(http_status.UNAUTHORIZED).end();
        return;
    }
    const User = ctx.database.model('User', user_schema);
    if (await User.findOne({email: register_token_data.sub}).exec()) {
        res.status(http_status.CONFLICT).end();
        return;
    }
    const metadata = await (new User(register_token_data.user)).save();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.post('/verify', (req, res) => {
    if (!("token" in req.body)) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    res.status(
        util.token.validateAuthToken(ctx, req.body.token)
            ? http_status.OK
            : http_status.UNAUTHORIZED
    ).end();
});

app.put('/profile', async (req, res) => {
    const token_data = util.token.validateAuthToken(ctx, req.header('Authorization'));
    if (!token_data) {
        res.status(http_status.UNAUTHORIZED).end();
        return;
    }
    const User = ctx.database.model('User', user_schema);
    const user = await User.findOne({_id: token_data.sub}).exec();
    if (!user) {
        res.status(http_status.NOT_FOUND).end();
        return;
    }
    user.nickname = req.body.nickname || token_data.user.nickname;
    const metadata = await user.save();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.put('/profile/email', async (req, res) => {
    const token_data = util.token.validateAuthToken(ctx, req.header('Authorization'));
    if (!token_data) {
        res.status(http_status.UNAUTHORIZED).end();
        return;
    }
    if (!(("email" in req.body && email_validator.validate(req.body.email)))) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const code = crypto.randomInt(10000000, 99999999);
    const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: req.ip, code};
    util.email('update_email', data).catch(console.error);
    const User = ctx.database.model('User', user_schema);
    if (await User.findOne({email: req.body.email}).exec()) {
        res.status(http_status.CONFLICT).end();
        return;
    }
    const metadata = {_id: token_data.sub, email: req.body.email};
    const update_email_token = await util.token.issueCodeToken(ctx, code, metadata);
    res.send({update_email_token});
});

app.post('/profile/email/verify', async (req, res) => {
    const token_data = util.token.validateAuthToken(ctx, req.header('Authorization'));
    if (!token_data) {
        res.status(http_status.UNAUTHORIZED).end();
        return;
    }
    if (!("code" in req.body && "update_email_token" in req.body && req.body.code.length === 8)) {
        res.status(http_status.BAD_REQUEST).end();
        return;
    }
    const update_email_token_data = util.token.validateCodeToken(ctx, req.body.code, req.body.update_email_token);
    if (!update_email_token_data || update_email_token_data.sub !== token_data.sub) {
        res.status(http_status.UNAUTHORIZED).end();
        return;
    }
    const User = ctx.database.model('User', user_schema);
    const user = await User.findOne({_id: update_email_token_data.sub}).exec();
    if (!user) {
        res.status(http_status.NOT_FOUND).end();
        return;
    }
    user.email = update_email_token_data.user.email;
    const metadata = await user.save();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.listen(process.env.HTTP_PORT, () => {
    console.log(constant.APP_NAME)
    console.log('====')
    console.log('Application is listening at')
    console.log(`http://localhost:${process.env.HTTP_PORT}`)
});
