import {StatusCodes} from "http-status-codes";
import {Router} from "express";

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

    router.post('/verify',
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

    r.use('/register', router);
};
