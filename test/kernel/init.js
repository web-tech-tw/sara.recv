"use strict";

const {runLoader} = require("../../src/config");

process.env.NODE_ENV = "testing";
runLoader();
