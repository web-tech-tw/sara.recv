import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { nanoid } from "nanoid";

// ============================================================
// Unit Tests: Core utilities (no DB required)
// ============================================================

describe("native.ts - sha256hex", () => {
    it("should produce a consistent 64-char hex string", async () => {
        const { sha256hex } = await import("../src/utils/native");
        const result = sha256hex("test@example.com");
        expect(result).toHaveLength(64);
        expect(result).toMatch(/^[a-f0-9]+$/);
    });

    it("should be deterministic for the same input", async () => {
        const { sha256hex } = await import("../src/utils/native");
        expect(sha256hex("hello")).toBe(sha256hex("hello"));
    });

    it("should differ for different inputs", async () => {
        const { sha256hex } = await import("../src/utils/native");
        expect(sha256hex("alice@test.com")).not.toBe(sha256hex("bob@test.com"));
    });
});

describe("native.ts - generateRandomCode", () => {
    it("should produce a string of the correct length", async () => {
        const { generateRandomCode } = await import("../src/utils/native");
        expect(generateRandomCode(6)).toHaveLength(6);
        expect(generateRandomCode(7)).toHaveLength(7);
        expect(generateRandomCode(8)).toHaveLength(8);
    });

    it("should be numeric only", async () => {
        const { generateRandomCode } = await import("../src/utils/native");
        expect(generateRandomCode(6)).toMatch(/^\d+$/);
    });
});

describe("native.ts - isObjectPropExists", () => {
    it("should return true for existing own properties", async () => {
        const { isObjectPropExists } = await import("../src/utils/native");
        expect(isObjectPropExists({ foo: 1 }, "foo")).toBe(true);
    });

    it("should return false for missing properties", async () => {
        const { isObjectPropExists } = await import("../src/utils/native");
        expect(isObjectPropExists({}, "bar")).toBe(false);
    });

    it("should return false for inherited properties (e.g. toString)", async () => {
        const { isObjectPropExists } = await import("../src/utils/native");
        expect(isObjectPropExists({}, "toString")).toBe(false);
    });
});

// ============================================================
// Unit Tests: code_session.ts (in-memory, no DB)
// ============================================================

describe("code_session.ts - createOne / getOne", () => {
    it("should create a session and retrieve it by code + sessionId", async () => {
        const { createOne, getOne } = await import("../src/utils/code_session");
        const metadata = { userId: "u1", email: "a@b.com" };
        const { code, sessionId } = createOne("create_token", metadata, 6, 60);

        expect(code).toHaveLength(6);
        expect(sessionId).toBeTruthy();

        const result = getOne("create_token", sessionId, code);
        expect(result).not.toBeNull();
        expect(result!.userId).toBe("u1");
        expect(result!.email).toBe("a@b.com");
    });

    it("should return null for wrong code", async () => {
        const { createOne, getOne } = await import("../src/utils/code_session");
        const { sessionId } = createOne("test_type", { x: 1 }, 6, 60);
        const result = getOne("test_type", sessionId, "000000");
        expect(result).toBeNull();
    });

    it("should delete the session after deleteIt() is called", async () => {
        const { createOne, getOne } = await import("../src/utils/code_session");
        const { code, sessionId } = createOne("test_del", { x: 1 }, 6, 60);
        const session = getOne("test_del", sessionId, code);
        expect(session).not.toBeNull();
        session!.deleteIt();
        expect(getOne("test_del", sessionId, code)).toBeNull();
    });

    it("should support different session types independently", async () => {
        const { createOne, getOne } = await import("../src/utils/code_session");
        const { code: c1, sessionId: s1 } = createOne("type_a", { val: "a" }, 6, 60);
        const { code: c2, sessionId: s2 } = createOne("type_b", { val: "b" }, 6, 60);

        expect(getOne("type_a", s1, c1)!.val).toBe("a");
        expect(getOne("type_b", s2, c2)!.val).toBe("b");
        // Cross-type access should fail
        expect(getOne("type_b", s1, c1)).toBeNull();
    });
});

// ============================================================
// Unit Tests: passkey_session.ts (in-memory, no DB)
// ============================================================

describe("passkey_session.ts - createOne / getOne", () => {
    it("should create and retrieve a passkey session", async () => {
        const { createOne, getOne } = await import("../src/utils/passkey_session");
        const { sessionId } = createOne("create_token", {
            userId: "u1",
            challenge: "abc123challenge",
        }, 60);

        expect(sessionId).toBeTruthy();
        const result = getOne("create_token", sessionId);
        expect(result).not.toBeNull();
        expect(result!.challenge).toBe("abc123challenge");
    });

    it("should return null for unknown sessionId", async () => {
        const { getOne } = await import("../src/utils/passkey_session");
        expect(getOne("create_token", nanoid())).toBeNull();
    });
});

// ============================================================
// Unit Tests: test_token.ts
// ============================================================

describe("test_token.ts - issue / validate roundtrip", () => {
    it("should issue a base64 token and validate it back", async () => {
        const testToken = await import("../src/utils/test_token");
        const token = testToken.issue();
        expect(typeof token).toBe("string");

        const result = testToken.validate(token);
        expect(result.isAborted).toBe(false);
        expect(result.userId).toBeTruthy();
        expect(result.payload.profile._id).toBeTruthy();
    });

    it("should abort on an invalid/tampered token", async () => {
        const testToken = await import("../src/utils/test_token");
        const result = testToken.validate("!!!not_valid_base64!!!");
        expect(result.isAborted).toBe(true);
    });

    it("should return different token from different user data", async () => {
        const testToken = await import("../src/utils/test_token");
        const fakeUser = { ...testToken.newProfile(), _id: "different_id", email: "other@example.com" };
        const t1 = testToken.issue();
        const t2 = testToken.issue(fakeUser);
        expect(t1).not.toBe(t2);
    });
});
