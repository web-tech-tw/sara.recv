import { useCache } from "../init/cache";
import { getIPAddress } from "../utils/visitor";
import { isProduction } from "../config";

const cache = useCache();

function getPathKey(urlStr: string, isParam: boolean) {
    const url = new URL(urlStr);
    const pathArray = url.pathname.split("/").filter((i) => !!i);
    if (isParam && pathArray.length > 0) {
        pathArray.pop();
    }
    return pathArray.join(".");
}

export const restrictorBefore = (max: number, ttl: number, isParam: boolean = false) => 
    ({ request, server, error }: any) => {
        const pathKey = getPathKey(request.url, isParam);
        const visitorKey = getIPAddress(request, server);
        const queryKey = ["restrictor", pathKey, visitorKey].join(":");

        const keyValue = (cache.get(queryKey) as number) || 0;

        if (keyValue > max) {
            if (!isProduction()) {
                console.warn(
                    "Too many forbidden requests received:",
                    `actual "${keyValue}"`,
                    `expect "${max}"`
                );
            }
            cache.set(queryKey, keyValue + 1, ttl);
            return error(429);
        }
    };

export const restrictorAfter = (ttl: number, isParam: boolean = false, customForbiddenStatus: number | null = null) => 
    ({ request, server, set }: any) => {
        const forbiddenStatus = customForbiddenStatus || 403;
        const currentStatus = typeof set.status === 'string' ? parseInt(set.status) : set.status;

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
                queryKey
            );
        }
    };
