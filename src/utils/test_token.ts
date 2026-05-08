// Token utils for testing/debugging or developing.
import { isProduction } from "../config";
import { sha256hex } from "./native";

// Default fake user
const DEFAULT_FAKE_USER = {
    _id: "67345206787c5d2b9be61c37",
    nickname: "Fake User",
    email: "fake_user@web-tech-tw.github.io",
    avatar_hash: sha256hex("fake_user@web-tech-tw.github.io"),
    roles: [] as string[],
};

/**
 * Returns a new user profile
 */
export function newProfile() {
    return structuredClone(DEFAULT_FAKE_USER);
}

/**
 * Issue token
 */
export function issue(userData?: any): string {
    if (isProduction()) {
        throw new Error("test_token is not allowed in production");
    }

    userData = userData || DEFAULT_FAKE_USER;

    const user = {
        _id: userData._id,
        email: userData.email,
        nickname: userData.nickname,
        avatar_hash: userData.avatar_hash,
        roles: userData.roles,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
    };

    const userJson = JSON.stringify(user);
    return Buffer.
        from(userJson, "utf-8").
        toString("base64");
}

/**
 * Validate token
 */
export function validate(token: string) {
    if (isProduction()) {
        throw new Error("test_token is not allowed in production");
    }

    const result: {
        userId: string | null;
        payload: any;
        isAborted: boolean;
    } = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const profile = JSON.parse(
            Buffer.
                from(token, "base64").
                toString("utf-8"),
        );

        result.userId = profile._id;
        result.payload = {
            profile,
        };
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}
