const {issueAuthToken, validateAuthToken} = require('../utils/token');
const ip_address = require("../utils/ip_address");

module.exports = (ctx) => function (req, res, next) {
    const auth_code = req.header('Authorization');
    if (!auth_code) {
        next();
        return;
    }
    const params = auth_code.split(" ");
    if (params.length !== 2) {
        next();
        return;
    }
    req.auth_method = params[0];
    req.auth_secret = params[1];
    switch (req.auth_method) {
        case "SARA": {
            req.authenticated = validateAuthToken(ctx, req.auth_secret);
            if (req.authenticated?.user) {
                const token = issueAuthToken(ctx, req.authenticated.user);
                res.header("Sara-Issue", token);
            }
            break;
        }
        case "SYS": {
            req.authenticated =
                ip_address(req) === process.env.SYSTEM_ADMIN_IP_ADDRESS &&
                req.auth_secret === process.env.SYSTEM_ADMIN_SECRET;
            break;
        }
    }
    next();
};
