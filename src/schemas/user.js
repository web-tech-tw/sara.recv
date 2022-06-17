"use strict";

const mongoose = require("mongoose");

const Schema = mongoose.Schema;

module.exports = new Schema({
    email: String,
    nickname: String,
    roles: Array,
    created_at: Number,
    updated_at: Number,
});
