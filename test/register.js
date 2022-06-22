"use strict";

// Import supertest
const request = require("supertest");

// Import mocha-steps
const {step} = require("mocha-steps");

// Import StatusCodes
const {StatusCodes} = require("http-status-codes");

// Initialize tests
const {app, ctx, fakeUser} = require("./init");
const testing = require("../src/utils/testing");
const to = testing.urlGlue("/login");

// Define tests
describe("/register", function() {
    let registerTokenWithSecret;

    before((done) => {
        // Reset database before test
        ctx.database.connection.dropDatabase(() => done());
    });

    step("register (request registerToken)", function(done) {
        request(app)
            .post(to("/"))
            .send(fakeUser)
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.OK)
            .then((res) => {
                registerTokenWithSecret = res.body;
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
            .send(registerTokenWithSecret)
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
