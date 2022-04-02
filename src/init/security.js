"use strict";
// JWT Security Check

const fs = require('fs');

const constant = require('./const');

let jwt_secret;
try {
    jwt_secret = fs.readFileSync(constant.SECRET_FILENAME).toString();
} catch (e) {
    if (e.code === 'ENOENT') {
        throw 'JWT secret is unset, please generate one with "npm run new-secret"'
    } else {
        console.log(e)
    }
}
if (jwt_secret.length < 2048) {
    throw 'JWT secret IS NOT SAFE, please generate the new one with "npm run new-secret"';
}

module.exports = jwt_secret;
