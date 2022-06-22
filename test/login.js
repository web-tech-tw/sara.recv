"use strict";

// Import supertest
const request = require("supertest");

// Import mocha-steps
const {step} = require("mocha-steps");

// Import StatusCodes
const {StatusCodes} = require("http-status-codes");

// Initialize tests
const {app, fakeUser} = require("./init");
const testing = require("../src/utils/testing");
const to = testing.urlGlue("/login");

// Define tests
describe("/login", function() {
    let nextTokenWithSecret;

    before((done) => {
        // Do register, no matter if the user already exists
        request(app)
            .post("/register")
            .send(fakeUser)
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
                .then(() => done()))
            .catch(() => done());
    });

    step("login (request nextToken)", function(done) {
        request(app)
            .post(to("/"))
            .send({email: fakeUser.email})
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.OK)
            .then((res) => {
                nextTokenWithSecret = res.body;
                done();
            })
            .catch((e) => {
                console.error(e);
                done(e);
            });
    });

    step("verify (get authToken)", function(done) {
        request(app)
            .post(to("/verify"))
            .send(nextTokenWithSecret)
            .type("form")
            .set("Accept", "application/json")
            .expect("Content-Type", /json/)
            .expect(StatusCodes.CREATED)
            .then((res) => {
                testing.log({
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
});
