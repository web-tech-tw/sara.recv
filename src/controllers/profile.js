const {StatusCodes} = require("http-status-codes");
const {Router} = require("express");

// Import modules
const
    crypto = require('crypto'),
    util = {
        mail_sender: require('../utils/mail_sender'),
        sara_token: require('../utils/sara_token'),
        ip_address: require('../utils/ip_address')
    },
    schema = {
        user: require("../schemas/user")
    },
    middleware = {
        access: require('../middlewares/access'),
        inspector: require('../middlewares/inspector'),
        validator: require('express-validator')
    };

// Export routes mapper (function)
module.exports = (ctx, r) => {
    const router = Router();

    router.get('/',
        middleware.access(null),
        async (req, res) => {
            res.send({profile: req.authenticated.user});
        }
    );

    router.put('/',
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

    router.put('/email',
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

    router.post('/email/verify',
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

    r.use('/profile', router);
};
