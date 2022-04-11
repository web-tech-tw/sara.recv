const http_status = require('http-status-codes');
const ip_address = require('../utils/ip_address');

module.exports = (role) => (req, res, next) => {
    const system_secret = req.header('System-Secret');
    if (
        system_secret && role === 'admin' &&
        ip_address(req) === process.env.SYSTEM_ADMIN_IP_ADDRESS &&
        system_secret === process.env.SYSTEM_ADMIN_SECRET
    ) {
        next();
        return;
    }
    const user_roles = req?.authenticated?.user?.roles;
    if (!(user_roles && Array.isArray(user_roles))) {
        res.sendStatus(http_status.UNAUTHORIZED);
        return;
    }
    if (role && !user_roles.includes(role)) {
        res.sendStatus(http_status.FORBIDDEN);
        return;
    }
    next();
};
