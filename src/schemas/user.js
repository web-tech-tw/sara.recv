"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

module.exports = new Schema({
    email: String,
    nickname: String,
    roles: [String],
    created_at: Number,
    updated_at: Number,
});
