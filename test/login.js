"use strict";

require("./kernel/init");

const utils = require("./kernel/utils");

const request = require("supertest");
const {step} = require("mocha-steps");

const {StatusCodes} = require("http-status-codes");

const {useApp} = require("../src/init/express");
const {useCache} = require("../src/init/cache");

// Initialize tests
const app = useApp();
const cache = useCache();

require("../src/routes/index")();
const to = utils.urlGlue("/login");

// Define tests
describe("/login", function() {
    const fakeUser = utils.generateFakeUser();
    before((done) => {
        utils.registerFakeUser(fakeUser).
            then(() => done());
    });

    step("request", function(done) {
        request(app)
            .post(to("/"))
            .send({email: fakeUser.email})
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.CREATED)
            .then((res) => {
                cache.set("_testing_session_id", res.body.session_id);
                done();
            })
            .catch((e) => {
                console.error(e);
                done(e);
            });
    });

    step("verify", function(done) {
        request(app)
            .post(to("/verify"))
            .send({
                session_id: cache.take("_testing_session_id"),
                code: cache.take("_testing_code"),
            })
            .type("form")
            .set("Accept", "text/plain")
            .expect("Content-Type", /plain/)
            .expect(StatusCodes.CREATED)
            .then((res) => {
                utils.log("sara-issue", res.headers["sara-issue"]);
                done();
            })
            .catch((e) => {
                console.error(e);
                done(e);
            });
    });
});
