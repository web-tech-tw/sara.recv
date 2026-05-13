import {useCache} from "../init/cache";
import {getIPAddress} from "../utils/visitor";
import {isProduction} from "../config";

const cache = useCache();

/**
 * Get path key for restrictor.
 * @param {string} urlStr - The URL string.
 * @param {boolean} isParam - Whether the path has a parameter at the end.
 * @return {string} The path key.
 */
function getPathKey(urlStr: string, isParam: boolean) {
    const url = new URL(urlStr);
    const pathArray = url.pathname.split("/").filter((i) => !!i);
    if (isParam && pathArray.length > 0) {
        pathArray.pop();
    }
    return pathArray.join(".");
}

/**
 * Restrictor before handle.
 * @param {number} max - The maximum allowed requests.
 * @param {number} ttl - The time to live in seconds.
 * @param {boolean} isParam - Whether the path has a parameter.
 * @return {Function} The before handle function.
 */
export const restrictorBefore = (
    max: number,
    ttl: number,
    isParam: boolean = false,
) =>
    ({request, server, status}: any) => {
        const pathKey = getPathKey(request.url, isParam);
        const visitorKey = getIPAddress(request, server);
        const queryKey = ["restrictor", pathKey, visitorKey].join(":");

        const keyValue = (cache.get(queryKey) as number) || 0;

        if (keyValue > max) {
            if (!isProduction()) {
                console.warn(
                    "Too many forbidden requests received:",
                    `actual "${keyValue}"`,
                    `expect "${max}"`,
                );
            }
            cache.set(queryKey, keyValue + 1, ttl);
            return status(429);
        }
    };

/**
 * Restrictor after response.
 * @param {number} ttl - The time to live in seconds.
 * @param {boolean} isParam - Whether the path has a parameter.
 * @param {number|null} customForbiddenStatus - Custom forbidden status.
 * @return {Function} The after response function.
 */
export const restrictorAfter = (
    ttl: number,
    isParam: boolean = false,
    customForbiddenStatus: number | null = null,
) =>
    ({request, server, set}: any) => {
        const forbiddenStatus = customForbiddenStatus || 403;
        const currentStatus = typeof set.status === "string" ?
            parseInt(set.status) : set.status;

        if (currentStatus !== forbiddenStatus) {
            return;
        }

        const pathKey = getPathKey(request.url, isParam);
        const visitorKey = getIPAddress(request, server);
        const queryKey = ["restrictor", pathKey, visitorKey].join(":");

        const keyValue = (cache.get(queryKey) as number) || 0;
        cache.set(queryKey, keyValue + 1, ttl);

        if (!isProduction()) {
            console.warn(
                "An forbidden request detected:",
                forbiddenStatus,
                queryKey,
            );
        }
    };
