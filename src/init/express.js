"use strict";

const express = require('express');
const requestIp = require('request-ip');

const app = express();
app.use(express.urlencoded({extended: true}));
app.use(requestIp.mw());

module.exports = app;
