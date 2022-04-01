"use strict";

const SECRET_FILENAME = 'secret.key';

const fs = require('fs')
const crypto = require('crypto');

const length = crypto.randomInt(2048, 1000000);
const bytes = crypto.randomBytes(length);
const secret = Buffer.from(bytes).toString('base64');

try {
    fs.writeFileSync(SECRET_FILENAME, secret);
    console.log(`The secret has been saved into "${SECRET_FILENAME}".`)
} catch (e) {
    console.error(e)
}
