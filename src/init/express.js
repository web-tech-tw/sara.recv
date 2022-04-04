"use strict";

const express = require('express');
const request_ip = require('request-ip');

const app = express();
app.use(express.urlencoded({extended: true}));
app.use(request_ip.mw());

module.exports = app;
