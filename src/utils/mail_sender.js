"use strict";
// Mail Sender of Sara

const {getMust, getEnabled} = require("../config");

const constant = require("../init/const");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: getMust("MAIL_SMTP_HOST"),
    port: getMust("MAIL_SMTP_PORT"),
    secure: getEnabled("MAIL_SMTP_SECURE"),
    auth: getMust("MAIL_SMTP_USERNAME") ? {
        user: getMust("MAIL_SMTP_USERNAME"),
        pass: getMust("MAIL_SMTP_PASSWORD"),
    } : null,
});

const isTestMailAddress = (addr) =>
    addr.endsWith("@" + constant.TEST_EMAIL_DOMAIN);

module.exports = function(template, data) {
    if (isTestMailAddress(data.to)) {
        return new Promise((resolve) => {
            if (getMust("NODE_ENV") !== "testing") {
                console.info("new_mail", {template, data});
            }
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
