import {isProduction} from "../config";
import uaParser from "ua-parser-js";

/**
 * Get IP Address.
 * @param {Request} request - The request object.
 * @param {any} server - The server object.
 * @return {string} The IP address.
 */
export function getIPAddress(request: Request, server: any): string {
    if (!isProduction()) {
        return "127.0.0.1";
    }
    // Bun specific IP retrieval
    return server?.requestIP(request)?.address || "unknown";
}

/**
 * Get User-Agent.
 * @param {Headers} headers - The headers object.
 * @param {boolean} isShort - Whether to return a short version.
 * @return {string} The user agent.
 */
export function getUserAgent(
    headers: Headers,
    isShort: boolean = false,
): string {
    const userAgent = headers.get("user-agent");
    if (!userAgent) {
        return "Unknown";
    }

    if (!isShort) {
        return userAgent;
    }

    const uaParsed = uaParser(userAgent);
    const {name: browserName} = uaParsed.browser;
    const {name: osName} = uaParsed.os;
    return [browserName, osName].filter(Boolean).join(" ");
}
