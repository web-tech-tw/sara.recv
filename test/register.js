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
const to = utils.urlGlue("/register");

// Define tests
describe("/register", function() {
    const fakeUser = utils.generateFakeUser();

    step("request", function(done) {
        request(app)
            .post(to("/"))
            .send(fakeUser)
            .type("form")
            .set("Accept", "application/json")
            .expect(StatusCodes.CREATED)
            .then((res) => {
                cache.set("_testing_session_id", res.body.session_id);
                utils.log(res.body);
                done();
            })
            .catch((e) => {
                utils.log(e);
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
            .expect(StatusCodes.CREATED)
            .then((res) => {
                utils.log("sara-issue", res.headers["sara-issue"]);
                done();
            })
            .catch((e) => {
                utils.log(e);
                done(e);
            });
    });
});
