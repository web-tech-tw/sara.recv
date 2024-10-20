"use strict";

const {useDatabase} = require("../init/database");
const database = useDatabase();

const schema = require("../schemas/passkey");
module.exports = database.model("Passkey", schema);
