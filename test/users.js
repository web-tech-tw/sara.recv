"use strict";

require("./kernel/init");

const utils = require("./kernel/utils");

const request = require("supertest");
const {step} = require("mocha-steps");

const {StatusCodes} = require("http-status-codes");

const {
    HEADER_REFRESH_TOKEN: headerRefreshToken,
} = require("../src/init/const");

const {useApp} = require("../src/init/express");
const {useCache} = require("../src/init/cache");

const {
    prepare: prepareDatabase,
} = require("../src/init/database");

// Initialize tests
const app = useApp();
const cache = useCache();

const routerDispatcher = require("../src/routes/index");
const to = utils.urlGlue("/users");
routerDispatcher.load();

// Define tests
describe("/users", function() {
    const fakeUser = utils.generateFakeUser();

    before(async () => {
        await utils.runPrepareHandlers(
            prepareDatabase,
        );
    });

    step("register", function(done) {
        request(app)
            .post(to("/"))
            .send(fakeUser)
            .type("json")
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

    step("verify register", function(done) {
        request(app)
            .patch(to("/"))
            .send({
                session_id: cache.take("_testing_session_id"),
                code: cache.take("_testing_code"),
            })
            .type("json")
            .expect(StatusCodes.CREATED)
            .then((res) => {
                utils.log(headerRefreshToken, res.headers[headerRefreshToken]);
                done();
            })
            .catch((e) => {
                utils.log(e);
                done(e);
            });
    });
});
