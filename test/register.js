"use strict";

// Import supertest
const request = require("supertest");

// Import StatusCodes
const {StatusCodes} = require("http-status-codes");

// Initialize tests
const {app, ctx, urlHelper} = require("./init");
const to = urlHelper("/register");

// Define tests
describe("/register", function() {
    let registerToken;

    before((done) => {
        // Reset database before every register test
        ctx.database.connection.dropDatabase(() => done());
    });

    it("register (request registerToken)", function(done) {
        request(app)
            .post(to("/"))
            .send({
                nickname: "Sara Hoshikawa",
                email: "sara@web-tech.github.io",
            })
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.OK)
            .then((res) => {
                registerToken = res.body;
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
            .send(registerToken)
            .type("form")
            .set("Accept", "application/json")
            .expect("Content-Type", /json/)
            .expect(StatusCodes.CREATED)
            .then(() => done());
    });
});
