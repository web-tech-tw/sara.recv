import { isProduction } from "../config";
import uaParser from "ua-parser-js";

/**
 * Get IP Address.
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
 */
export function getUserAgent(headers: Headers, isShort: boolean = false): string {
    const userAgent = headers.get("user-agent");
    if (!userAgent) {
        return "Unknown";
    }

    if (!isShort) {
        return userAgent;
    }

    const uaParsed = uaParser(userAgent);
    const { name: browserName } = uaParsed.browser;
    const { name: osName } = uaParsed.os;
    return [browserName, osName].filter(Boolean).join(" ");
}
