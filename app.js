"use strict";

const APP_NAME = 'sara.recv'
const express = require('express')
const http_status = require('http-status-codes')
const email_validator = require('email-validator');
const app = express()
const port = 3000

app.use(express.urlencoded({extended: true}))

app.get('/', (req, res) => {
    res.send(APP_NAME)
})

app.post('/login', (req, res) => {
    if (!("email" in req.body)) {
        res.status(http_status.BAD_REQUEST).end()
    } else if (email_validator.validate(req.body["email"])) {
        res.status(http_status.CREATED).end()
    } else {
        res.status(http_status.FORBIDDEN).end()
    }
})

app.post('/register', (req, res) => {
    if (!("email" in req.body)) {
        res.status(http_status.BAD_REQUEST).end()
    } else if (email_validator.validate(req.body["email"])) {
        res.status(http_status.CREATED).end()
    } else {
        res.status(http_status.FORBIDDEN).end()
    }
})

app.listen(port, () => {
    console.log(APP_NAME)
    console.log('====')
    console.log(`Application is listening at http://localhost:${port}`)
})
