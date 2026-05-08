import { nanoid as generateNanoId } from "nanoid";
import { useCache } from "../init/cache";

const cache = useCache();

const getSessionCodeName = (type: string, sessionId: string) => 
    `passkey:${type}:${sessionId}`;

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
