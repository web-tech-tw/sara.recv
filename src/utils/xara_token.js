"use strict";
// Token utils of Sara.

// Import config
const {getMust} = require("../config");

// Import createHmac from crypto
const {createHmac} = require("node:crypto");

// Import jsonwebtoken
const {sign, verify} = require("jsonwebtoken");

// Import const
const {
    APP_NAME: issuerIdentity,
} = require("../init/const");

// Import usePublicKey and usePrivateKey
const {
    usePublicKey,
    usePrivateKey,
} = require("../init/keypair");

// Import user model
const User = require("../models/user");

// Import token model
const Token = require("../models/token");

// Define hmac function - SHA256
const hmac256hex = (data, key) =>
    createHmac("sha256", key).update(data).digest("hex");

// Define issueOptions
const issueOptions = {
    algorithm: "ES256",
    expiresIn: "1d",
    notBefore: "500ms",
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    noTimestamp: false,
    mutatePayload: false,
};

// Define updateOptions
const updateOptions = {
    algorithm: "ES256",
    noTimestamp: false,
    mutatePayload: false,
};

// Define validateOptions
const validateOptions = {
    algorithms: ["ES256"],
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    complete: true,
};

/**
 * Issue token
 * @module sara_token
 * @function
 * @async
 * @param {object} userData - The user data to generate the token for.
 * @return {Promise<string>}
 */
async function issue(userData) {
    const user = {
        _id: userData._id,
        email: userData.email,
        nickname: userData.nickname,
        avatar_hash: userData.avatar_hash,
        roles: userData.roles,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
    };

    const userId = userData._id;
    const userRevision = userData.revision;

    const privateKey = usePrivateKey();
    const guardSecret = getMust("SARA_GUARD_SECRET");

    const token = new Token({userId});
    const tokenIdPrefix = (await token.save()).id;
    const tokenIdSuffix = userRevision;
    const tokenId = [
        tokenIdPrefix,
        tokenIdSuffix,
    ].join("/");

    const saraTokenPayload = {user, sub: userId, jti: tokenId};
    const saraToken = sign(saraTokenPayload, privateKey, issueOptions);
    const guardToken = hmac256hex(tokenId, guardSecret);

    return [saraToken, guardToken].join("|");
}

/**
 * Update token
 * @module sara_token
 * @function
 * @param {object} token - The token to update.
 * @param {object} userData - The user data to update.
 * @return {string}
 */
function update(token, userData) {
    const user = {
        _id: userData._id,
        email: userData.email,
        nickname: userData.nickname,
        avatar_hash: userData.avatar_hash,
        roles: userData.roles,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
    };

    const userId = userData._id.toString();
    const userRevision = userData.revision;

    const publicKey = usePublicKey();
    const privateKey = usePrivateKey();
    const guardSecret = getMust("SARA_GUARD_SECRET");

    const [
        originalSaraToken,
        originalGuardToken,
    ] = token.split("|", 2);

    const {payload: saraTokenPayload} =
        verify(originalSaraToken, publicKey, validateOptions);

    if (userId !== saraTokenPayload.sub) {
        throw new Error("unexpect user id");
    }

    const expectedOriginalGuardToken = hmac256hex(
        saraTokenPayload.jti,
        guardSecret,
    );
    if (originalGuardToken !== expectedOriginalGuardToken) {
        throw new Error("unexpect guard token");
    }

    const [
        originalTokenIdPrefix,
        originalTokenIdSuffix,
    ] = saraTokenPayload.jti.split("/", 2);
    const tokenId = [
        originalTokenIdPrefix,
        userRevision,
    ].join("/");

    if (userRevision <= parseInt(originalTokenIdSuffix)) {
        throw new Error("unexpect user version");
    }

    saraTokenPayload.jti = tokenId;
    saraTokenPayload.user = {
        ...saraTokenPayload.user,
        ...user,
    };

    const saraToken = sign(saraTokenPayload, privateKey, updateOptions);
    const guardToken = hmac256hex(tokenId, guardSecret);

    return [saraToken, guardToken].join("|");
}

/**
 * Validate token
 * @module sara_token
 * @function
 * @async
 * @param {string} token - The token to valid.
 * @return {Promise<object>}
 */
async function validate(token) {
    const publicKey = usePublicKey();
    const result = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const [saraToken, guardToken] = token.split("|", 2);
        const {payload} = verify(
            saraToken, publicKey, validateOptions,
        );

        const guardSecret = getMust("SARA_GUARD_SECRET");
        const guardTokenExpected = hmac256hex(payload.jti, guardSecret);
        if (guardToken !== guardTokenExpected) {
            throw new Error("unexpect guard token");
        }

        const [
            tokenIdPrefix,
            tokenIdSuffix,
        ] = payload.jti.split("/", 2);

        const tokenState = await Token.findById(tokenIdPrefix);
        if (!tokenState) {
            throw new Error("token not found");
        }

        const user = await User.findById(tokenState.userId);
        if (!user) {
            throw new Error("user not found");
        }

        if (user.revision !== parseInt(tokenIdSuffix)) {
            throw new Error("user revision mismatch");
        }

        result.userId = payload.sub;
        result.payload = {
            profile: payload.user,
        };
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}

// Export (object)
module.exports = {
    issue,
    update,
    validate,
};
