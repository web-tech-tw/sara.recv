import crypto from "node:crypto";

/**
 * Shortcut for hasOwnProperty with safe.
 * @param {object} srcObject - The source object.
 * @param {string} propName - The property name.
 * @return {boolean} Whether the property exists.
 */
export function isObjectPropExists(
    srcObject: object,
    propName: string,
): boolean {
    return Object.hasOwn(srcObject, propName);
}

/**
 * Generate random code with length.
 * @param {number} length - The length of the code.
 * @return {string} The generated code.
 */
export function generateRandomCode(length: number): string {
    const maxValue = Math.pow(10, length) - 1;
    return crypto.
        randomInt(0, maxValue).
        toString().
        padStart(length, "0");
}

/**
 * Hash string into sha256 hex.
 * @param {string} data - The data to hash.
 * @return {string} The sha256 hex string.
 */
export function sha256hex(data: string): string {
    return crypto.
        createHash("sha256").
        update(data).
        digest("hex");
}
