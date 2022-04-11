const {validateAuthToken} = require('../utils/token');

module.exports = (ctx) => function (req, res, next) {
    req.authenticated = validateAuthToken(ctx, req.header('Authorization'));
    next();
};
