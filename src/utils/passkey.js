"use strict";

const {
    InferRawDocType,
} = require("mongoose");

const {
    WebAuthnCredential,
} = require("@simplewebauthn/types");

const Passkey = require("../schemas/passkey");

/**
 * Convert passkey to BSON.
 * @param {string} label - The label.
 * @param {WebAuthnCredential} credential - The passkey.
 * @return {InferRawDocType<typeof Passkey>}
 */
function toPasskeyBSON(label, credential) {
    return {
        _id: credential.id,
        public_key: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports,
        label,
    };
}

/**
 * Convert BSON to passkey.
 * @param {InferRawDocType<typeof Passkey>} credential - The passkey.
 * @return {WebAuthnCredential}
 */
function fromPasskeyBSON(credential) {
    return {
        id: credential._id,
        publicKey: credential.public_key,
        counter: credential.counter,
        transports: credential.transports,
    };
}

module.exports = {
    toPasskeyBSON,
    fromPasskeyBSON,
};
