// Mail Sender of Sara
import { getMust, getEnabled, get } from "../config";
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

const isTestMailAddress = (addr: string) =>
    addr.endsWith("@" + constant.TEST_EMAIL_DOMAIN);

export default async function sendMail(template: string, data: any): Promise<any> {
    if (isTestMailAddress(data.to)) {
        if (getMust("NODE_ENV") === "development") {
            console.info("new_mail", { template, data });
        }
        return Promise.resolve();
    }

    // Use path relative to the file
    const templateModule = await import(`../templates/mail/${template}.ts`);
    const { subject, text, html } = templateModule;

    return transporter.sendMail({
        from: getMust("MAIL_SMTP_FROM"),
        to: data.to,
        cc: data.cc,
        subject: subject(data),
        text: text(data),
        html: html(data),
    });
}
