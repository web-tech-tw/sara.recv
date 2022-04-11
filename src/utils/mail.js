"use strict";

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOST,
    port: process.env.MAIL_SMTP_PORT,
    secure: process.env.MAIL_SMTP_SECURE === 'yes',
    auth: process.env.MAIL_SMTP_USERNAME ? {
        user: process.env.MAIL_SMTP_USERNAME,
        pass: process.env.MAIL_SMTP_PASSWORD,
    } : null,
});

module.exports = function (template, data) {
    const {subject, text, html} = require(`../templates/mail/${template}.js`);
    return transporter.sendMail({
        from: process.env.MAIL_SMTP_FROM,
        to: data.to,
        subject: subject(data),
        text: text(data),
        html: html(data),
    });
};
