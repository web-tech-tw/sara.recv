"use strict";

const {useDatabase} = require("../init/database");
const database = useDatabase();

const schema = require("../schemas/user");
module.exports = database.model("User", schema);
