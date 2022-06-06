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
        inspector: require('../middlewares/inspector'),
        validator: require('express-validator')
    };

// Export routes mapper (function)
module.exports = (ctx, r) => {
    const router = Router();

    router.post('/',
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

    router.post('/verify',
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

    r.use('/login', router);
};
