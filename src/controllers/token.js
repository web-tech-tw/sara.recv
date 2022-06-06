const {StatusCodes} = require("http-status-codes");
const {Router} = require("express");

// Import modules
const
    util = {
        sara_token: require('../utils/sara_token'),
    },
    middleware = {
        inspector: require('../middlewares/inspector'),
        validator: require('express-validator')
    };

// Export routes mapper (function)
module.exports = (ctx, r) => {
    const router = Router();

    router.post('/verify',
        middleware.validator.body('token'),
        middleware.inspector,
        (req, res) => {
            const data = util.sara_token.validateAuthToken(ctx, req.body.token);
            res.sendStatus(data ? StatusCodes.OK : StatusCodes.UNAUTHORIZED);
        }
    );

    router.post('/decode',
        middleware.validator.body('token'),
        middleware.inspector,
        (req, res) => {
            const data = util.sara_token.validateAuthToken(ctx, req.body.token);
            res.status(data ? StatusCodes.OK : StatusCodes.UNAUTHORIZED).send(data);
        }
    );

    r.use('/token', router);
};
