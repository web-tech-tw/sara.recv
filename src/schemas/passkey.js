"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

module.exports = new Schema({
    _id: {
        type: String,
        required: true,
        unique: true,
    },
    label: {
        type: String,
        required: true,
    },
    public_key: {
        type: Buffer,
        required: true,
    },
    counter: {
        type: Number,
        required: true,
    },
    transports: {
        type: [String],
        required: true,
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
