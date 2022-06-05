"use strict";

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

module.exports = new Schema({
    _id: ObjectId,
    email: String,
    nickname: String,
    roles: Array,
    created_at: Number,
    updated_at: Number,
});
