import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { nanoid } from "nanoid";

// ============================================================
// Integration Tests: /users & /tokens API
// Requires: MongoDB running at MONGODB_URI in .env
// ============================================================

// Shared state across test steps
const state: {
    fakeUser: { nickname: string; email: string } | null;
    registerSessionId: string | null;
    registerCode: string | null;
    xaraToken: string | null;
    loginSessionId: string | null;
    loginCode: string | null;
} = {
    fakeUser: null,
    registerSessionId: null,
    registerCode: null,
    xaraToken: null,
    loginSessionId: null,
    loginCode: null,
};

const userAgent = "bun-test/1.0 sara-recv-integration";

function generateFakeUser() {
    const id = nanoid(8).toLowerCase();
    return {
        nickname: `TestUser_${id}`,
        email: `test_${id}@integration.local`,
    };
}

// ============================================================
// Setup
// ============================================================

let app: any;
let cache: any;
let HEADER_REFRESH_TOKEN: string;

beforeAll(async () => {
    // Dynamic import to ensure env is loaded first
    const { app: _app } = await import("../src/index");
    const { useCache } = await import("../src/init/cache");
    const constants = await import("../src/init/const");

    app = _app;
    cache = useCache();
    HEADER_REFRESH_TOKEN = constants.HEADER_REFRESH_TOKEN;

    // Give DB connection a moment
    await new Promise(r => setTimeout(r, 500));
});

// ============================================================
// /users - Registration flow
// ============================================================

describe("/users - register", () => {
    it("Step 1: POST /users/ → should return 201 with session_id", async () => {
        state.fakeUser = generateFakeUser();

        const res = await app.handle(new Request("http://localhost/users/", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": userAgent,
            },
            body: JSON.stringify(state.fakeUser),
        }));

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.session_id).toBeTruthy();

        state.registerSessionId = body.session_id;
        state.registerCode = cache.get("_testing_code");

        console.log("[register] session_id:", state.registerSessionId, "code:", state.registerCode);
    });

    it("Step 2: PATCH /users/ → should return 201 and X-Refresh-Token header", async () => {
        expect(state.registerSessionId).toBeTruthy();
        expect(state.registerCode).toBeTruthy();

        const res = await app.handle(new Request("http://localhost/users/", {
            method: "PATCH",
            headers: {
                "content-type": "application/json",
                "user-agent": userAgent,
            },
            body: JSON.stringify({
                code: state.registerCode,
                session_id: state.registerSessionId,
            }),
        }));

        expect(res.status).toBe(201);
        const refreshToken = res.headers.get(HEADER_REFRESH_TOKEN);
        expect(refreshToken).toBeTruthy();
        state.xaraToken = refreshToken;

        console.log("[register verify] xaraToken prefix:", state.xaraToken?.slice(0, 30) + "...");
    });

    it("Step 3: POST /users/ with same email → should return 409 Conflict", async () => {
        const res = await app.handle(new Request("http://localhost/users/", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": userAgent,
            },
            body: JSON.stringify(state.fakeUser!),
        }));

        expect(res.status).toBe(409);
    });
});

// ============================================================
// /tokens - Login flow
// ============================================================

describe("/tokens - login", () => {
    it("Step 1: POST /tokens/ → should return 201 with session_id", async () => {
        expect(state.fakeUser).toBeTruthy();

        const res = await app.handle(new Request("http://localhost/tokens/", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": userAgent,
            },
            body: JSON.stringify({ email: state.fakeUser!.email }),
        }));

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.session_id).toBeTruthy();

        state.loginSessionId = body.session_id;
        state.loginCode = cache.get("_testing_code");

        console.log("[login] session_id:", state.loginSessionId, "code:", state.loginCode);
    });

    it("Step 2: PATCH /tokens/ → should return 201 and X-Refresh-Token header", async () => {
        expect(state.loginSessionId).toBeTruthy();
        expect(state.loginCode).toBeTruthy();

        const res = await app.handle(new Request("http://localhost/tokens/", {
            method: "PATCH",
            headers: {
                "content-type": "application/json",
                "user-agent": userAgent,
            },
            body: JSON.stringify({
                code: state.loginCode,
                session_id: state.loginSessionId,
            }),
        }));

        expect(res.status).toBe(201);
        const refreshToken = res.headers.get(HEADER_REFRESH_TOKEN);
        expect(refreshToken).toBeTruthy();

        console.log("[login verify] xaraToken prefix:", refreshToken?.slice(0, 30) + "...");
    });

    it("Step 3: POST /tokens/ with non-existent email → should return 404", async () => {
        const res = await app.handle(new Request("http://localhost/tokens/", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": userAgent,
            },
            body: JSON.stringify({ email: "nobody@does.not.exist.local" }),
        }));

        expect(res.status).toBe(404);
    });
});

// ============================================================
// /users/me - Authenticated profile access
// ============================================================

describe("/users/me - authenticated profile", () => {
    it("GET /users/me with valid XARA token → should return 200 with profile", async () => {
        expect(state.xaraToken).toBeTruthy();

        const res = await app.handle(new Request("http://localhost/users/me", {
            method: "GET",
            headers: {
                "authorization": `XARA ${state.xaraToken}`,
            },
        }));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.profile).toBeTruthy();
        expect(body.profile.email).toBe(state.fakeUser!.email);
        expect(body.profile.nickname).toBe(state.fakeUser!.nickname);
        expect(body.profile.avatar_hash).toBeTruthy();
    });

    it("GET /users/me without token → should return 401", async () => {
        const res = await app.handle(new Request("http://localhost/users/me", {
            method: "GET",
        }));

        expect(res.status).toBe(401);
    });
});
