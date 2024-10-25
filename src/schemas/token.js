"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;
const {ObjectId} = Schema.Types;

const schema = new Schema({
    userId: {
        type: ObjectId,
        required: true,
    },
}, {
    timestamps: true,
});

module.exports = schema;
