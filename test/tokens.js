"use strict";

const {
    USER_AGENT: userAgent,
} = require("./kernel/init");

const {
    print,
    urlGlue,
    toTest,
    toPrepare,
    generateFakeUser,
    registerFakeUser,
} = require("./kernel/utils");

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
const to = urlGlue("/tokens");
routerDispatcher.load();

// Define tests
describe("/tokens", function() {
    const fakeUser = generateFakeUser();
    const fakeUserRegister = () => registerFakeUser(fakeUser);

    before(toPrepare(
        prepareDatabase,
        fakeUserRegister,
    ));

    step("login", toTest(async function() {
        const response = await request(app).
            post(to("/")).
            set("user-agent", userAgent).
            type("json").
            send({email: fakeUser.email}).
            expect(StatusCodes.CREATED).
            expect("content-type", /json/);

        const {
            session_id: sessionId,
        } = response.body;

        const code = cache.get("_testing_code");
        cache.set("_testing_session_id", sessionId);

        print(code, response.body);
    }));

    step("login verify", toTest(async function() {
        const code = cache.take("_testing_code");
        const sessionId = cache.take("_testing_session_id");

        const response = await request(app).
            patch(to("/")).
            set("user-agent", userAgent).
            type("json").
            send({
                code: code,
                session_id: sessionId,
            }).
            expect(StatusCodes.CREATED).
            expect("content-type", /plain/);

        const {
            [headerRefreshToken]: refreshToken,
        } = response.headers;

        print(refreshToken);
    }));
});
