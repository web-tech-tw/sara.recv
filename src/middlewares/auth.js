const {validateAuthToken} = require('../utils/token');

module.exports = (ctx) => function (req, res, next) {
    const token = req.header('Authorization');
    if (token) {
        req.authenticated = validateAuthToken(ctx, token);
    }
    next();
};
