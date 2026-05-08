import { generateRandomCode } from "./native";
import { nanoid as generateNanoId } from "nanoid";
import { useCache } from "../init/cache";

const cache = useCache();

const getSessionCodeName = (type: string, sessionId: string, code: string) =>
    `code:${type}:${sessionId}@${code}`;

export function createOne(type: string, metadata: any, codeLength: number, ttl: number) {
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
