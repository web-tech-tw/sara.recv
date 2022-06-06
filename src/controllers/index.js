const routes = [
    require('./login'),
    require('./profile'),
    require('./register'),
    require('./token'),
    require('./user'),
];

module.exports = (ctx, app) => {
    routes.forEach((c) => c(ctx, app));
};
