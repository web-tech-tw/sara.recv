"use strict";
// Constants

// Export (object)
module.exports = {
    APP_NAME: "sara.recv",
    SECRET_FILENAME: "secret.key",
    BFAP_CONFIG_CODE_TOKEN: {
        type: "code_token",
        maxRetry: 10,
        ttl: 86_400,
    },
    BFAP_CONFIG_IP_LOGIN: {
        type: "ip_login",
        maxRetry: 10,
        ttl: 3_600,
    },
    BFAP_CONFIG_IP_REGISTER: {
        type: "ip_register",
        maxRetry: 20,
        ttl: 3_600,
    },
};
