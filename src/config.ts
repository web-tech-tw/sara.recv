import { join as pathJoin } from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

/**
 * Load configs from system environment variables.
 */
export function runLoader(): void {
    // In Bun, import.meta.dir is the equivalent of __dirname
    const dotenvPath = pathJoin(import.meta.dir, "..", ".env");

    const isDotEnvFileExists = existsSync(dotenvPath);
    const isCustomDefined = get("APP_CONFIGURED") === "1";

    if (!isDotEnvFileExists && !isCustomDefined) {
        console.error(
            "No '.env' file detected in app root.",
            "If you're not using dotenv file,",
            "set 'APP_CONFIGURED=1' into environment variables.",
            "\n",
        );
        throw new Error(".env not exists");
    }

    dotenv.config();
}

/**
 * Check is production mode.
 */
export function isProduction(): boolean {
    return getMust("NODE_ENV") === "production";
}

/**
 * Get environment overview.
 */
export function getEnvironmentOverview(): { node: string; runtime: string } {
    return {
        node: getFallback("NODE_ENV", "development"),
        runtime: getFallback("RUNTIME_ENV", "bun"),
    };
}

/**
 * Shortcut to get config value.
 */
export function get(key: string): string | undefined {
    return process.env[key];
}

/**
 * Get the bool value from config, if yes, returns true.
 */
export function getEnabled(key: string): boolean {
    return getMust(key) === "yes";
}

/**
 * Get the array value from config.
 */
export function getSplited(key: string, separator: string = ","): string[] {
    return getMust(key)
        .split(separator)
        .filter((s) => !!s)
        .map((s) => s.trim());
}

/**
 * Get the value from config with error thrown.
 */
export function getMust(key: string): string {
    const value = get(key);
    if (value === undefined) {
        throw new Error(`config key ${key} is undefined`);
    }
    return value;
}

/**
 * Get the value from config with fallback.
 */
export function getFallback(key: string, fallback: string): string {
    return get(key) || fallback;
}
