const {issueAuthToken, validateAuthToken} = require('../utils/token');
const ip_address = require("../utils/ip_address");
const user_schema = require("../schemas/user");

module.exports = (ctx) => {
    const get_user = async (user_id) => {
        const User = ctx.database.model('User', user_schema);
        const user = await User.findById(user_id).exec();
        if (!user) return null;
        ctx.cache.set(`TokenU:${user_id}`, user.updated_at, 3600);
        return user;
    };
    const methods = {
        "SARA": (req, res) => {
            req.authenticated = validateAuthToken(ctx, req.auth_secret);
            if (req.authenticated?.user) {
                const last_updated = ctx.cache.get(`TokenU:${req.authenticated.sub}`);
                if (last_updated !== req.authenticated.user.updated_at) {
                    req.authenticated.user = get_user(req.authenticated.sub);
                }
                const token = issueAuthToken(ctx, req.authenticated.user);
                res.header("Sara-Issue", token);
            }
        },
        "SYS": (req, _) => {
            req.authenticated =
                ip_address(req) === process.env.SYSTEM_ADMIN_IP_ADDRESS &&
                req.auth_secret === process.env.SYSTEM_ADMIN_SECRET;
        }
    };
    return (req, res, next) => {
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
        if (req.auth_method in methods) {
            methods[req.auth_method](req, res);
        }
        next();
    }
};
