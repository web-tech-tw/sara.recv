"use strict";

// Import supertest
const request = require("supertest");

// Import StatusCodes
const {StatusCodes} = require("http-status-codes");

// Initialize tests
const {app} = require("./init");

// Define tests
describe("POST /login", function() {
    it("login", function(done) {
        request(app)
            .post("/login")
            .send({
                email: "sara@web-tech.github.io",
            })
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.OK)
            .then((res) => request(app)
                .post("/login/verify")
                .send(res.body)
                .type("form")
                .set("Accept", "application/json")
                .expect("Content-Type", /json/)
                .expect(StatusCodes.CREATED)
                .then((res) => {
                    console.log({
                        token: res.headers["sara-issue"],
                        metadata: res.body,
                    });
                    done();
                })
            )
            .catch((e) => {
                console.error(e);
                done(e);
            });
    });
})
;
