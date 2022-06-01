"use strict";

require('dotenv').config();

const
    crypto = require('crypto'),
    {StatusCodes} = require('http-status-codes');

const
    constant = require('./src/init/const'),
    ctx = {
        now: () => Math.floor(new Date().getTime() / 1000),
        cache: require('./src/init/cache'),
        database: require('./src/init/database'),
        jwt_secret: require('./src/init/jwt_secret')
    },
    util = {
        mail_sender: require('./src/utils/mail_sender'),
        sara_token: require('./src/utils/sara_token'),
        ip_address: require('./src/utils/ip_address')
    },
    schema = {
        user: require("./src/schemas/user")
    },
    middleware = {
        access: require('./src/middlewares/access'),
        inspector: require('./src/middlewares/inspector'),
        validator: require('express-validator')
    };

const app = require('./src/init/express')(ctx);

app.get('/', (req, res) => {
    res.redirect(StatusCodes.MOVED_PERMANENTLY, process.env.WEBSITE_URL);
});

app.get('/ip', (req, res) => {
    res.send({ip_address: util.ip_address(req)});
});

app.post('/login',
    middleware.validator.body('email').isEmail(),
    middleware.inspector,
    async (req, res) => {
        const User = ctx.database.model('User', schema.user);
        if (!(await User.findOne({email: req.body.email}))) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        const code = crypto.randomInt(100000, 999999);
        const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: util.ip_address(req), code};
        util.mail_sender('login', data).catch(console.error);
        const metadata = {email: req.body.email};
        const next_token = util.sara_token.issueCodeToken(ctx, code, metadata);
        res.send({next_token});
    }
);

app.post('/login/verify',
    middleware.validator.body('code').isNumeric(),
    middleware.validator.body('code').isLength({min: 6, max: 6}),
    middleware.validator.body('next_token').isString(),
    middleware.inspector,
    async (req, res) => {
        const next_token_data = util.sara_token.validateCodeToken(ctx, req.body.code, req.body.next_token);
        if (!next_token_data) {
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        }
        if (util.sara_token.isGone(ctx, next_token_data)) {
            res.sendStatus(StatusCodes.GONE);
            return;
        }
        const User = ctx.database.model('User', schema.user);
        const user = await User.findOne({email: next_token_data.sub}).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        const metadata = user.toObject();
        const token = util.sara_token.issueAuthToken(ctx, metadata);
        res.header("Sara-Issue", token).sendStatus(StatusCodes.CREATED);
    }
);

app.post('/register',
    middleware.validator.body('nickname').isString(),
    middleware.validator.body('email').isEmail(),
    middleware.inspector,
    async (req, res) => {
        const code = crypto.randomInt(1000000, 9999999);
        const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: util.ip_address(req), code};
        util.mail_sender('register', data).catch(console.error);
        const User = ctx.database.model('User', schema.user);
        if (await User.findOne({email: req.body.email})) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }
        const metadata = {
            nickname: req.body.nickname,
            email: req.body.email,
            created_at: ctx.now(),
            updated_at: ctx.now()
        };
        const register_token = util.sara_token.issueCodeToken(ctx, code, metadata);
        res.send({register_token});
    }
);

app.post('/register/verify',
    middleware.validator.body('code').isNumeric(),
    middleware.validator.body('code').isLength({min: 7, max: 7}),
    middleware.validator.body('register_token').isString(),
    middleware.inspector,
    async (req, res) => {
        const register_token_data = util.sara_token.validateCodeToken(ctx, req.body.code, req.body.register_token);
        if (!register_token_data) {
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        }
        if (util.sara_token.isGone(ctx, register_token_data)) {
            res.sendStatus(StatusCodes.GONE);
            return;
        }
        const User = ctx.database.model('User', schema.user);
        if (await User.findOne({email: register_token_data.sub})) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }
        const metadata = await (new User(register_token_data.user)).save();
        const token = util.sara_token.issueAuthToken(ctx, metadata);
        res.header("Sara-Issue", token).sendStatus(StatusCodes.CREATED);
    }
);

app.get('/profile',
    middleware.access(null),
    async (req, res) => {
        res.send({profile: req.authenticated.user});
    }
);

app.put('/profile',
    middleware.access(null),
    async (req, res) => {
        const User = ctx.database.model('User', schema.user);
        const user = await User.findById(req.authenticated.sub).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        user.nickname = req?.body?.nickname || req.authenticated.user.nickname;
        user.updated_at = ctx.now();
        const metadata = await user.save();
        ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
        const token = util.sara_token.issueAuthToken(ctx, metadata);
        res.header("Sara-Issue", token).sendStatus(StatusCodes.CREATED);
    }
);

app.put('/profile/email',
    middleware.access(null),
    middleware.validator.body('email').isEmail(),
    middleware.inspector,
    async (req, res) => {
        const code = crypto.randomInt(10000000, 99999999);
        const data = {website: process.env.WEBSITE_URL, to: req.body.email, ip_address: util.ip_address(req), code};
        util.mail_sender('update_email', data).catch(console.error);
        const User = ctx.database.model('User', schema.user);
        if (await User.findOne({email: req.body.email})) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }
        const metadata = {_id: req.authenticated.sub, email: req.body.email};
        const update_email_token = util.sara_token.issueCodeToken(ctx, code, metadata);
        res.send({update_email_token});
    }
);

app.post('/profile/email/verify',
    middleware.access(null),
    middleware.validator.body('code').isNumeric(),
    middleware.validator.body('code').isLength({min: 8, max: 8}),
    middleware.validator.body('update_email_token').isString(),
    middleware.inspector,
    async (req, res) => {
        const update_email_token_data = util.sara_token.validateCodeToken(ctx, req.body.code, req.body.update_email_token);
        if (!update_email_token_data || update_email_token_data.sub !== req.authenticated.sub) {
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        }
        if (util.sara_token.isGone(ctx, update_email_token_data)) {
            res.sendStatus(StatusCodes.GONE);
            return;
        }
        const User = ctx.database.model('User', schema.user);
        const user = await User.findById(update_email_token_data.sub).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        user.email = update_email_token_data.user.email;
        user.updated_at = ctx.now();
        const metadata = await user.save();
        ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
        const token = util.sara_token.issueAuthToken(ctx, metadata);
        res.header("Sara-Issue", token).sendStatus(StatusCodes.CREATED);
    }
);

app.get('/user',
    middleware.access('admin'),
    middleware.validator.query('user_id'),
    middleware.inspector,
    async (req, res) => {
        const User = ctx.database.model('User', schema.user);
        try {
            res.send(await User.findById(req.query.user_id).exec());
        } catch (e) {
            if (e.kind !== 'ObjectId') console.error(e);
            res.sendStatus(StatusCodes.BAD_REQUEST);
        }
    }
);

app.post('/user/role',
    middleware.access('admin'),
    middleware.validator.body('user_id').isString(),
    middleware.validator.body('role').isString(),
    middleware.inspector,
    async (req, res) => {
        const User = ctx.database.model('User', schema.user);
        let user;
        try {
            user = await User.findById(req.body.user_id).exec();
        } catch (e) {
            if (e.kind !== 'ObjectId') console.error(e);
            res.sendStatus(StatusCodes.BAD_REQUEST);
            return;
        }
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        if (!Array.isArray(user?.roles)) {
            user.roles = [req.body.role];
        } else if (user.roles.includes(req.body.role)) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        } else {
            user.roles.push(req.body.role);
        }
        user.updated_at = ctx.now();
        await user.save();
        ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
        res.sendStatus(StatusCodes.CREATED);
    }
);

app.delete('/user/role',
    middleware.access('admin'),
    middleware.validator.body('user_id').isString(),
    middleware.validator.body('role').isString(),
    middleware.inspector,
    async (req, res) => {
        const User = ctx.database.model('User', schema.user);
        let user;
        try {
            user = await User.findById(req.body.user_id).exec();
        } catch (e) {
            if (e.kind !== 'ObjectId') console.error(e);
            res.sendStatus(StatusCodes.BAD_REQUEST);
            return;
        }
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }
        if (Array.isArray(user?.roles) && user.roles.includes(req.body.role)) {
            const index = user.roles.indexOf(req.body.role);
            user.roles.splice(index, 1);
        } else {
            res.sendStatus(StatusCodes.GONE);
            return;
        }
        user.updated_at = ctx.now();
        await user.save();
        ctx.cache.set(`TokenU:${req.authenticated.sub}`, ctx.now(), 3600);
        res.sendStatus(StatusCodes.NO_CONTENT);
    }
);

app.post('/token/verify',
    middleware.validator.body('token'),
    middleware.inspector,
    (req, res) => {
        const data = util.token.validateAuthToken(ctx, req.body.token);
        res.sendStatus(data ? StatusCodes.OK : StatusCodes.UNAUTHORIZED);
    }
);

app.post('/token/decode',
    middleware.validator.body('token'),
    middleware.inspector,
    (req, res) => {
        const data = util.token.validateAuthToken(ctx, req.body.token);
        res.status(data ? StatusCodes.OK : StatusCodes.UNAUTHORIZED).send(data);
    }
);

console.log(`${constant.APP_NAME} (runtime: ${process.env.RUNTIME_ENV || "native"})\n====`);
require('./src/execute')(app, ({type, hostname, port}) => {
    const protocol = type === 'general' ? 'http' : 'https';
    console.log(`Protocol "${protocol}" is listening at`);
    console.log(`${protocol}://${hostname}:${port}`);
});
