"use strict";
// Mail Sender of Sara

const nodemailer = require("nodemailer");
const {getMust, getEnabled} = require("../config");

const utilTesting = require("./testing");

const transporter = nodemailer.createTransport({
    host: getMust("MAIL_SMTP_HOST"),
    port: getMust("MAIL_SMTP_PORT"),
    secure: getEnabled("MAIL_SMTP_SECURE"),
    auth: getMust("MAIL_SMTP_USERNAME") ? {
        user: getMust("MAIL_SMTP_USERNAME"),
        pass: getMust("MAIL_SMTP_PASSWORD"),
    } : null,
});

module.exports = function(template, data) {
    if (utilTesting.isTestMailAddress(data.to)) {
        return new Promise((resolve) => {
            utilTesting.log(
                "\nmail template:", template,
                "\nmail data:", data,
            );
            resolve();
        });
    }

    const {subject, text, html} = require(`../templates/mail/${template}.js`);
    return transporter.sendMail({
        from: getMust("MAIL_SMTP_FROM"),
        to: data.to,
        subject: subject(data),
        text: text(data),
        html: html(data),
    });
};
