"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

const Passkey = require("./passkey");

const schema = new Schema({
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
    revision: {
        type: Number,
        default: 0,
    },
    passkeys: {
        type: [Passkey],
        default: [],
    },
}, {
    timestamps: true,
});

module.exports = schema;
