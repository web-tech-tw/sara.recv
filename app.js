"use strict";

// Load configs from .env
require('dotenv').config();

// Import StatusCodes
const {StatusCodes} = require('http-status-codes');

// Import modules
const
    constant = require('./src/init/const'),
    ctx = {
        now: () => Math.floor(new Date().getTime() / 1000),
        cache: require('./src/init/cache'),
        database: require('./src/init/database'),
        jwt_secret: require('./src/init/jwt_secret')
    },
    util = {
        ip_address: require('./src/utils/ip_address')
    };

// Initialize application
const app = require('./src/init/express')(ctx);

// Redirect / to WEBSITE_URL
app.get('/', (req, res) => {
    res.redirect(StatusCodes.MOVED_PERMANENTLY, process.env.WEBSITE_URL);
});

// The handler for robots.txt (deny all friendly robots)
app.get('/robots.txt', (_, res) => res.type('txt').send("User-agent: *\nDisallow: /"));

// Example to show the visitor's IP with util.ip_address
app.get('/ip', (req, res) => {
    res.send({ip_address: util.ip_address(req)});
});

// Map Routes
require('./src/controllers/index')(ctx, app);

// Show status message
console.log(
    constant.APP_NAME,
    `(runtime: ${process.env.NODE_ENV}, ${process.env.RUNTIME_ENV || "native"})`,
    '\n===='
);
// Mount application and execute it
require('./src/execute')(app, ({type, hostname, port}) => {
    const protocol = type === 'general' ? 'http' : 'https';
    console.log(`Protocol "${protocol}" is listening at`);
    console.log(`${protocol}://${hostname}:${port}`);
});
