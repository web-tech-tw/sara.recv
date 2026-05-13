import {nanoid as generateNanoId} from "nanoid";
import {useCache} from "../init/cache";

const cache = useCache();

/**
 * Get session code name.
 * @param {string} type - The session type.
 * @param {string} sessionId - The session ID.
 * @return {string} The cache key.
 */
const getSessionCodeName = (type: string, sessionId: string) =>
    `passkey:${type}:${sessionId}`;

/**
 * Create a new passkey session.
 * @param {string} type - The session type.
 * @param {any} metadata - The session metadata.
 * @param {number} ttl - The time to live in seconds.
 * @return {object} The session data.
 */
export function createOne(type: string, metadata: any, ttl: number) {
    const sessionId = generateNanoId();
    const sessionCodeName = getSessionCodeName(type, sessionId);

    cache.set(sessionCodeName, metadata, ttl);
    const deleteIt = () => {
        cache.del(sessionCodeName);
    };

    return {
        sessionId,
        deleteIt,
    };
}

/**
 * Get a passkey session.
 * @param {string} type - The session type.
 * @param {string} sessionId - The session ID.
 * @return {object|null} The session data or null if not found.
 */
export function getOne(type: string, sessionId: string) {
    const sessionCodeName = getSessionCodeName(type, sessionId);
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
