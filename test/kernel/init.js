"use strict";

const {runLoader} = require("../../src/config");
runLoader();

process.env.NODE_ENV = "testing";

exports.USER_AGENT =
    "Opera/9.80 (Windows NT 6.0) Presto/2.12.388 Version/12.14";
