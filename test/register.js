"use strict";

// Import supertest
const request = require("supertest");

// Import StatusCodes
const {StatusCodes} = require("http-status-codes");

// Initialize tests
const {app, ctx} = require("./init");

// Define tests
beforeEach((done) => {
    // Reset database before every register test
    ctx.database.connection.dropDatabase(() => done());
});

describe("POST /register", function() {
    it("register a user", function(done) {
        request(app)
            .post("/register")
            .send({
                nickname: "Sara Hoshikawa",
                email: "sara@web-tech.github.io",
            })
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.OK)
            .then((res) => request(app)
                .post("/register/verify")
                .send(res.body)
                .type("form")
                .set("Accept", "application/json")
                .expect("Content-Type", /json/)
                .expect(StatusCodes.CREATED)
                .then(() => done())
            )
            .catch((e) => {
                console.error(e);
                done(e);
            });
    });
});
