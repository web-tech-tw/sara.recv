const { StatusCodes } = require('http-status-codes');

module.exports = (role) => (req, res, next) => {
    if (req.auth_method === 'SYS' && req.authenticated && role === 'admin') {
        next();
        return;
    }
    const user = req?.authenticated?.user;
    if (!(user && Array.isArray(user?.roles))) {
        res.sendStatus(StatusCodes.UNAUTHORIZED);
        return;
    }
    if (role && !user.roles.includes(role)) {
        res.sendStatus(StatusCodes.FORBIDDEN);
        return;
    }
    next();
};
