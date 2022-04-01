"use strict";

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const user = new Schema({
    author: ObjectId,
    title: String,
    body: String,
    date: Date
});

module.exports = user;
