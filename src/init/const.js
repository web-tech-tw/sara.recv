"use strict";
// Constants

exports.APP_NAME = "sara.recv";
exports.SECRET_FILENAME = "secret.key";

exports.TEST_EMAIL_DOMAIN = "web-tech.github.io";

exports.BFAP_CONFIG_IP_LOGIN = {
    type: "ip_login",
    maxRetry: 10,
    ttl: 3_600,
};
exports.BFAP_CONFIG_IP_REGISTER = {
    type: "ip_register",
    maxRetry: 20,
    ttl: 3_600,
};
