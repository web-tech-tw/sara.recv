"use strict";
// Token utils of Sara.

// Import crypto
const crypto = require("crypto");

// Import jsonwebtoken
const jwt = require("jsonwebtoken");

// Import UUID generator
const {v4: uuidV4} = require("uuid");

// Import SHA256 generator
const {sha256} = require("js-sha256");

// Import inspect of BFAP
const {inspect: bfapInspact} = require("../utils/bfap");

// Import constant
const constant = require("../init/const");

const {useJwtSecret} = require("../init/jwt_secret");
const {useCache} = require("../init/cache");

const jwtSecret = useJwtSecret();
const cache = useCache();

const {
    getPosixTimestamp,
} = require("../utils/native");

// Define generalIssueOptions generator
const generalIssueOptions = ({type}) => ({
    algorithm: "HS256",
    expiresIn: "1d",
    notBefore: "500ms",
    audience: process.env.WEBSITE_URL,
    issuer: sha256(jwtSecret),
    noTimestamp: false,
    mutatePayload: false,
    header: {
        sara: {
            version: 1,
            type: type,
            point: {
                client: {
                    login: process.env.SARA_CLIENT_LOGIN_URL,
                    register: process.env.SARA_CLIENT_REGISTER_URL,
                },
                api: {
                    token: {
                        verify: process.env.SARA_API_TOKEN_VERIFY_URL,
                        decode: process.env.SARA_API_TOKEN_DECODE_URL,
                    },
                },
            },
        },
    },
});

// Define generalValidateOptions generator
const generalValidateOptions = () => ({
    algorithms: ["HS256"],
    audience: process.env.WEBSITE_URL,
    issuer: sha256(jwtSecret),
    complete: true,
});

/**
 * Issue function (Auth)
 * @param {object} user - The user data to issue.
 * @return {object|null}
 */
function issueAuthToken(user) {
    const issueOptions = generalIssueOptions({type: "auth"});
    const jti = uuidV4(null, null, null);
    const secret = crypto.randomInt(2048, 1000000).toString();
    const payload = {
        jti,
        user,
        sub: user._id || user.email,
        sec: sha256([jti, secret].join(".")),
    };
    const token = jwt.sign(
        payload,
        jwtSecret,
        issueOptions,
        null,
    );
    return {token, secret};
}

/**
 * Issue function (Code)
 * @param {number} codeLength - Length of code to issue.
 * @param {object} data - The metadata to pass
 * @return {object|null}
 */
function issueCodeToken(codeLength, data) {
    const code = crypto.randomInt(
        10 ** (codeLength - 1),
        (10 ** codeLength) - 1,
    ).toString();
    const jwtSecret = `${jwtSecret}_${code}`;
    const issueOptions = generalIssueOptions({type: "code"});
    const payload = {
        data,
        sub: data._id || data.email,
        jti: uuidV4(null, null, null),
    };
    const token = jwt.sign(
        payload,
        jwtSecret,
        issueOptions,
        null,
    );
    return {token, code};
}

/**
 * Validate function (Auth)
 * @param {string} token - The token to valid.
 * @return {boolean|object}
 */
function validateAuthToken(token) {
    try {
        const validateOptions = generalValidateOptions();
        const data = jwt.verify(token, jwtSecret, validateOptions, null);
        if (
            data?.header?.sara?.version !== 1 ||
            data?.header?.sara?.type !== "auth"
        ) {
            console.error("invalid_sara_code_token");
            return false;
        }
        return data.payload;
    } catch (e) {
        console.error(e);
        return false;
    }
}

/**
 * Validate function (Code)
 * @param {string} code - The code to valid.
 * @param {string} token - The token to valid.
 * @return {boolean|object}
 */
function validateCodeToken(code, token) {
    if (bfapInspact(
        constant.BFAP_CONFIG_CODE_TOKEN,
        token,
    )) {
        console.error("brute_force");
        return false;
    }
    try {
        const jwtSecret = `${jwtSecret}_${code}`;
        const validateOptions = generalValidateOptions();
        const data = jwt.verify(token, jwtSecret, validateOptions, null);
        if (
            data?.header?.sara?.version !== 1 ||
            data?.header?.sara?.type !== "code"
        ) {
            console.error("invalid_sara_code_token");
            return false;
        }
        return data.payload;
    } catch (e) {
        console.error(e);
        return false;
    }
}

/**
 * Replay attack protection.
 * @param {object} tokenData - The data decoded from token.
 * @return {boolean}
 */
function isGone(tokenData) {
    const {jti, exp} = tokenData;
    const keyName = `token_gone:${jti}`;
    if (cache.has(keyName)) return true;
    const ttl = exp - getPosixTimestamp();
    cache.set(keyName, true, ttl);
    return false;
}

// Export (object)
module.exports = {
    issueAuthToken,
    issueCodeToken,
    validateAuthToken,
    validateCodeToken,
    isGone,
};
