// Mail Sender of Sara
import {getMust, getEnabled, get, getFallback} from "../config";
import * as constant from "../init/const";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: getMust("MAIL_SMTP_HOST"),
    port: parseInt(getMust("MAIL_SMTP_PORT")),
    secure: getEnabled("MAIL_SMTP_SECURE"),
    auth: get("MAIL_SMTP_USERNAME") ? {
        user: get("MAIL_SMTP_USERNAME") as string,
        pass: get("MAIL_SMTP_PASSWORD") as string,
    } : undefined,
});

/**
 * Check if address is a test mail address.
 * @param {string} addr - The address to check.
 * @return {boolean} Whether it is a test mail address.
 */
const isTestMailAddress = (addr: string) =>
    addr.endsWith("@" + constant.TEST_EMAIL_DOMAIN);

/**
 * Send an email using a template.
 * @param {string} template - The template name.
 * @param {any} data - The data for the template.
 * @return {Promise<any>} The result of sending the mail.
 */
export default async function sendMail(
    template: string,
    data: any,
): Promise<any> {
    const nodeEnv = getFallback("NODE_ENV", "development");
    if (isTestMailAddress(data.to) || nodeEnv === "testing") {
        if (nodeEnv === "development" || nodeEnv === "testing") {
            console.info("new_mail", {template, data});
        }
        return Promise.resolve();
    }

    // Use path relative to the file
    const templateModule = await import(`../templates/mail/${template}.ts`);
    const {subject, text, html} = templateModule;

    return transporter.sendMail({
        from: getMust("MAIL_SMTP_FROM"),
        to: data.to,
        cc: data.cc,
        subject: subject(data),
        text: text(data),
        html: html(data),
    });
}
