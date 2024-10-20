"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

const schemaPasskey = require("./passkey");

module.exports = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    nickname: {
        type: String,
        required: true,
    },
    roles: {
        type: [String],
        default: [],
    },
    passkeys: {
        type: [schemaPasskey],
        default: [],
    },
    created_at: {
        type: Number,
        default: Date.now,
    },
    updated_at: {
        type: Number,
        default: Date.now,
    },
});
