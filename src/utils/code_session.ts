import {generateRandomCode} from "./native";
import {nanoid as generateNanoId} from "nanoid";
import {useCache} from "../init/cache";

const cache = useCache();

/**
 * Get session code name.
 * @param {string} type - The session type.
 * @param {string} sessionId - The session ID.
 * @param {string} code - The code.
 * @return {string} The cache key.
 */
const getSessionCodeName = (type: string, sessionId: string, code: string) =>
    `code:${type}:${sessionId}@${code}`;

/**
 * Create a new code session.
 * @param {string} type - The session type.
 * @param {any} metadata - The session metadata.
 * @param {number} codeLength - The code length.
 * @param {number} ttl - The time to live in seconds.
 * @return {object} The session data.
 */
export function createOne(
    type: string,
    metadata: any,
    codeLength: number,
    ttl: number,
) {
    const sessionId = generateNanoId();
    const code = generateRandomCode(codeLength);
    const sessionCodeName = getSessionCodeName(type, sessionId, code);

    cache.set(sessionCodeName, metadata, ttl);
    const deleteIt = () => {
        cache.del(sessionCodeName);
    };

    return {
        code,
        sessionId,
        deleteIt,
    };
}

/**
 * Get a code session.
 * @param {string} type - The session type.
 * @param {string} sessionId - The session ID.
 * @param {string} code - The code.
 * @return {object|null} The session data or null if not found.
 */
export function getOne(type: string, sessionId: string, code: string) {
    const sessionCodeName = getSessionCodeName(type, sessionId, code);
    if (!cache.has(sessionCodeName)) {
        return null;
    }

    const metadata = cache.get(sessionCodeName) as any;
    const deleteIt = () => {
        cache.del(sessionCodeName);
    };

    return {
        ...metadata,
        deleteIt,
    };
}
