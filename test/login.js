"use strict";

// Import supertest
const request = require("supertest");

// Import StatusCodes
const {StatusCodes} = require("http-status-codes");

// Initialize tests
const {app, urlHelper} = require("./init");
const to = urlHelper("/login");

// Define tests
describe("/login", function() {
    let nextToken;

    it("login (request nextToken)", function(done) {
        request(app)
            .post(to("/"))
            .send({
                email: "sara@web-tech.github.io",
            })
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.OK)
            .then((res) => {
                nextToken = res.body;
                done();
            })
            .catch((e) => {
                console.error(e);
                done(e);
            });
    });

    it("verify (get authToken)", function(done) {
        request(app)
            .post(to("/verify"))
            .send(nextToken)
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
            .catch((e) => {
                console.error(e);
                done(e);
            });
    });
})
;
