const http_status = require('http-status-codes');

module.exports = (req, res, next) => {
    if (!req.authenticated) {
        res.sendStatus(http_status.UNAUTHORIZED);
        return;
    }
    next();
};
