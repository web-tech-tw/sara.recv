import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../src/index";

describe("Sara RECV Elysia Smoke Test", () => {
    it("should return 200 for robots.txt", async () => {
        const response = await app.handle(
            new Request("http://localhost/robots.txt")
        );
        expect(response.status).toBe(200);
        expect(await response.text()).toContain("User-agent: *");
    });

    it("should redirect for /", async () => {
        const response = await app.handle(
            new Request("http://localhost/")
        );
        expect(response.status).toBeGreaterThanOrEqual(301);
        expect(response.status).toBeLessThanOrEqual(302);
    });

    it("should have swagger documentation", async () => {
        const response = await app.handle(
            new Request("http://localhost/swagger")
        );
        expect(response.status).toBe(200);
    });
});
