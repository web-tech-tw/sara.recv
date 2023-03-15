"use strict";
// Mail Sender of Sara

const nodemailer = require("nodemailer");
const {isProduction} = require("../config");
const testing = require("./testing");

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOST,
    port: process.env.MAIL_SMTP_PORT,
    secure: process.env.MAIL_SMTP_SECURE === "yes",
    auth: process.env.MAIL_SMTP_USERNAME ? {
        user: process.env.MAIL_SMTP_USERNAME,
        pass: process.env.MAIL_SMTP_PASSWORD,
    } : null,
});

module.exports = function(template, data) {
    if (!isProduction) {
        return new Promise((resolve) => {
            testing.log("\nmail template:", template, "\nmail data:", data);
            resolve();
        });
    }

    const {subject, text, html} = require(`../templates/mail/${template}.js`);
    return transporter.sendMail({
        from: process.env.MAIL_SMTP_FROM,
        to: data.to,
        subject: subject(data),
        text: text(data),
        html: html(data),
    });
};
