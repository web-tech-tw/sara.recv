"use strict";

require('dotenv').config();

const
    crypto = require('crypto'),
    http_status = require('http-status-codes'),
    email_validator = require('email-validator');

const
    constant = require('./src/init/const'),
    ctx = {
        now: () => Math.floor(new Date().getTime() / 1000),
        cache: require('./src/init/cache'),
        database: require('./src/init/database'),
        jwt_secret: require('./src/init/jwt_secret')
    },
    util = {
        email: require('./src/utils/mail'),
        token: require('./src/utils/token'),
        access: require('./src/utils/access'),
        ip_address: require('./src/utils/ip_address')
    },
    schema = {
        user: require("./src/schemas/user")
    };

const app = require('./src/init/express')(ctx);

app.get('/', (req, res) => {
    res.redirect(http_status.MOVED_PERMANENTLY, process.env.WEBSITE_URL);
});

app.post('/login', async (req, res) => {
    if (!(req?.body?.email && email_validator.validate(req.body.email))) {
        res.sendStatus(http_status.BAD_REQUEST);
        return;
    }
    const User = ctx.database.model('User', schema.user);
    if (!(await User.findOne({email: req.body.email}).exec())) {
        res.sendStatus(http_status.NOT_FOUND);
        return;
    }
    const code = crypto.randomInt(100000, 999999);
    const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: util.ip_address(req), code};
    util.email('login', data).catch(console.error);
    const metadata = {email: req.body.email};
    const next_token = await util.token.issueCodeToken(ctx, code, metadata);
    res.send({next_token});
});

app.post('/login/verify', async (req, res) => {
    if (!(req?.body?.code && req?.body?.next_token && req.body.code.length === 6)) {
        res.sendStatus(http_status.BAD_REQUEST);
        return;
    }
    const next_token_data = util.token.validateCodeToken(ctx, req.body.code, req.body.next_token);
    if (!next_token_data) {
        res.sendStatus(http_status.UNAUTHORIZED);
        return;
    }
    if (util.token.isGone(ctx, next_token_data)) {
        res.sendStatus(http_status.GONE);
        return;
    }
    const User = ctx.database.model('User', schema.user);
    const user = await User.findOne({email: next_token_data.sub}).exec();
    if (!user) {
        res.sendStatus(http_status.NOT_FOUND);
        return;
    }
    const metadata = user.toObject();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.post('/register', async (req, res) => {
    if (!(req?.body?.nickname && req?.body?.email && email_validator.validate(req.body.email))) {
        res.sendStatus(http_status.BAD_REQUEST);
        return;
    }
    const code = crypto.randomInt(1000000, 9999999);
    const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: util.ip_address(req), code};
    util.email('register', data).catch(console.error);
    const User = ctx.database.model('User', schema.user);
    if (await User.findOne({email: req.body.email}).exec()) {
        res.sendStatus(http_status.CONFLICT);
        return;
    }
    const metadata = {nickname: req.body.nickname, email: req.body.email};
    const register_token = await util.token.issueCodeToken(ctx, code, metadata);
    res.send({register_token});
});

app.post('/register/verify', async (req, res) => {
    if (!(req?.body?.code && req?.body?.register_token && req.body.code.length === 7)) {
        res.sendStatus(http_status.BAD_REQUEST);
        return;
    }
    const register_token_data = util.token.validateCodeToken(ctx, req.body.code, req.body.register_token);
    if (!register_token_data) {
        res.sendStatus(http_status.UNAUTHORIZED);
        return;
    }
    if (util.token.isGone(ctx, register_token_data)) {
        res.sendStatus(http_status.GONE);
        return;
    }
    const User = ctx.database.model('User', schema.user);
    if (await User.findOne({email: register_token_data.sub}).exec()) {
        res.sendStatus(http_status.CONFLICT);
        return;
    }
    const metadata = await (new User(register_token_data.user)).save();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.get('/profile', util.access, async (req, res) => {
    res.send({profile: req.authenticated.user});
});

app.put('/profile', util.access, async (req, res) => {
    const User = ctx.database.model('User', schema.user);
    const user = await User.findOne({_id: req.authenticated.sub}).exec();
    if (!user) {
        res.sendStatus(http_status.NOT_FOUND);
        return;
    }
    user.nickname = req?.body?.nickname || req.authenticated.user.nickname;
    const metadata = await user.save();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.put('/profile/email', util.access, async (req, res) => {
    if (!(req?.body?.email && email_validator.validate(req.body.email))) {
        res.sendStatus(http_status.BAD_REQUEST);
        return;
    }
    const code = crypto.randomInt(10000000, 99999999);
    const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: util.ip_address(req), code};
    util.email('update_email', data).catch(console.error);
    const User = ctx.database.model('User', schema.user);
    if (await User.findOne({email: req.body.email}).exec()) {
        res.sendStatus(http_status.CONFLICT);
        return;
    }
    const metadata = {_id: req.authenticated.sub, email: req.body.email};
    const update_email_token = await util.token.issueCodeToken(ctx, code, metadata);
    res.send({update_email_token});
});

app.post('/profile/email/verify', util.access, async (req, res) => {
    if (!(req?.body?.code && req?.body?.update_email_token && req.body.code.length === 8)) {
        res.sendStatus(http_status.BAD_REQUEST);
        return;
    }
    const update_email_token_data = util.token.validateCodeToken(ctx, req.body.code, req.body.update_email_token);
    if (!update_email_token_data || update_email_token_data.sub !== req.authenticated.sub) {
        res.sendStatus(http_status.UNAUTHORIZED);
        return;
    }
    if (util.token.isGone(ctx, update_email_token_data)) {
        res.sendStatus(http_status.GONE);
        return;
    }
    const User = ctx.database.model('User', schema.user);
    const user = await User.findOne({_id: update_email_token_data.sub}).exec();
    if (!user) {
        res.sendStatus(http_status.NOT_FOUND);
        return;
    }
    user.email = update_email_token_data.user.email;
    const metadata = await user.save();
    const token = await util.token.issueAuthToken(ctx, metadata);
    res.send({token});
});

app.listen(process.env.HTTP_PORT, process.env.HTTP_HOSTNAME, () => {
    console.log(constant.APP_NAME)
    console.log('====')
    console.log('Application is listening at')
    console.log(`http://localhost:${process.env.HTTP_PORT}`)
});
