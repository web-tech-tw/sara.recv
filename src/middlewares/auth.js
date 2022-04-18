const {validateAuthToken} = require('../utils/token');
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
    switch (params[0]) {
        case "SARA": {
            req.authenticated = validateAuthToken(ctx, params[1]);
            break;
        }
        case "SYS": {
            req.authenticated =
                ip_address(req) === process.env.SYSTEM_ADMIN_IP_ADDRESS &&
                params[1] === process.env.SYSTEM_ADMIN_SECRET;
            break;
        }
    }
    next();
};
