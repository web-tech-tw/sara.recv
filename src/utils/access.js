const http_status = require('http-status-codes');

module.exports = (role) => (req, res, next) => {
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
