"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

const schema = new Schema({
    label: {
        type: String,
        required: true,
    },
    credential: {
        type: {
            id: {
                type: String,
                required: true,
            },
            publicKey: {
                type: Buffer,
                required: true,
                set: (val) => Buffer.from(val),
            },
            counter: {
                type: Number,
                required: true,
            },
            transports: {
                type: [String],
                required: true,
            },
        },
        required: true,
    },
}, {
    timestamps: true,
});

module.exports = schema;
