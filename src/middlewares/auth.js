"use strict";
// Validate "Authorization" header, but it will not interrupt the request.
// To interrupt the request which without the request, please use "access.js" middleware.

// Import modules
const {issueAuthToken, validateAuthToken} = require('../utils/sara_token');
const ip_address = require("../utils/ip_address");

// Import auth_methods
const auth_methods = {
    "SARA": async (ctx, req, _) => {
        const get_user = async (user_id) => {
            const user_schema = require("../schemas/user");
            const User = ctx.database.model('User', user_schema);
            const user = await User.findById(user_id).exec();
            if (!user) return null;
            ctx.cache.set(`TokenU:${user_id}`, user.updated_at, 3600);
            return user;
        };
        req.authenticated = validateAuthToken(ctx, req.auth_secret);
        if (req.authenticated?.sub) {
            const last_updated = ctx.cache.get(`TokenU:${req.authenticated.sub}`);
            if (last_updated !== req.authenticated.user.updated_at) {
                    req.authenticated.user = await get_user(req.authenticated.sub);
            }
        }
        if (req.authenticated?.user) {
            const token = issueAuthToken(ctx, req.authenticated.user);
            res.header("Sara-Issue", token);
        }
    },
    "SYS": async (ctx, req, _) => {
        req.authenticated =
            ip_address(req) === process.env.SARA_SYSTEM_ADMIN_IP_ADDRESS &&
            req.auth_secret === process.env.SARA_SYSTEM_ADMIN_SECRET;
    }
};

// Export (function)
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
    if (!(req.auth_method in auth_methods)) {
        next();
        return;
    }
    auth_methods[req.auth_method](ctx, req, res)
        .then(() => next())
        .catch((error) => console.error(error));
};
