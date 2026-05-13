import {join as pathJoin} from "node:path";
import {existsSync} from "node:fs";
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
 * @return {boolean} Is production mode.
 */
export function isProduction(): boolean {
    return getFallback("NODE_ENV", "development") === "production";
}

/**
 * Get environment overview.
 * @return {{node: string, runtime: string}} Environment overview.
 */
export function getEnvironmentOverview(): { node: string; runtime: string } {
    return {
        node: getFallback("NODE_ENV", "development"),
        runtime: getFallback("RUNTIME_ENV", "bun"),
    };
}

/**
 * Shortcut to get config value.
 * @param {string} key Config key.
 * @return {string|undefined} Config value.
 */
export function get(key: string): string | undefined {
    return process.env[key];
}

/**
 * Get the bool value from config, if yes, returns true.
 * @param {string} key Config key.
 * @return {boolean} Config value.
 */
export function getEnabled(key: string): boolean {
    return getMust(key) === "yes";
}

/**
 * Get the array value from config.
 * @param {string} key Config key.
 * @param {string} [separator=","] Separator.
 * @return {string[]} Config values.
 */
export function getSplited(key: string, separator: string = ","): string[] {
    return getMust(key)
        .split(separator)
        .filter((s) => !!s)
        .map((s) => s.trim());
}

/**
 * Get the value from config with error thrown.
 * @param {string} key Config key.
 * @return {string} Config value.
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
 * @param {string} key Config key.
 * @param {string} fallback Fallback value.
 * @return {string} Config value.
 */
export function getFallback(key: string, fallback: string): string {
    return get(key) || fallback;
}
