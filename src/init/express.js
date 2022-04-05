"use strict";

const express = require('express');
const request_ip = require('request-ip');

const app = express();
app.use(express.urlencoded({extended: true}));
app.use(request_ip.mw());

if (process.env.HTTP_CORS === 'yes') {
    const cors = require('cors');
    app.use(cors({origin: process.env.WEBSITE_URL}));
}

module.exports = app;
