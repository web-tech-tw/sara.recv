"use strict";

const {getMust} = require("../config");

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const {useDatabase} = require("../init/database");
const {useCache} = require("../init/cache");

const utilMailSender = require("../utils/mail_sender");
const utilSaraToken = require("../utils/sara_token");
const utilCodeSession = require("../utils/code_session");
const utilVisitor = require("../utils/visitor");
const utilUser = require("../utils/user");
const utilNative = require("../utils/native");

const schemaUser = require("../schemas/user");

const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");
const middlewareRestrictor = require("../middleware/restrictor");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.urlencoded({extended: true}));

const database = useDatabase();
const cache = useCache();

router.post("/",
    middlewareValidator.body("nickname").notEmpty(),
    middlewareValidator.body("email").isEmail(),
    middlewareInspector,
    middlewareRestrictor(20, 3600, false),
    async (req, res) => {
        // Handle code and metadata
        const metadata = {
            nickname: req.body.nickname,
            email: req.body.email,
            created_at: utilNative.getPosixTimestamp(),
            updated_at: utilNative.getPosixTimestamp(),
        };
        const {code, sessionId} = utilCodeSession.createOne(metadata, 7, 1800);

        // Handle mail
        try {
            await utilMailSender("register", {
                to: req.body.email,
                website: getMust("SARA_AUDIENCE_URL"),
                ip_address: utilVisitor.getIPAddress(req),
                code,
            });
            if (getMust("NODE_ENV") === "testing") {
                cache.set("_testing_code", code);
            }
        } catch (e) {
            console.error(e);
            res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
            return;
        }

        // Handle conflict
        const User = database.model("User", schemaUser);
        if (await User.findOne({email: req.body.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Send response
        res.
            status(StatusCodes.CREATED).
            send({
                session_type: "register",
                session_id: sessionId,
            });
    },
);

router.post("/verify",
    middlewareValidator.body("code").isNumeric(),
    middlewareValidator.body("code").isLength({min: 7, max: 7}),
    middlewareValidator.body("session_id").notEmpty(),
    middlewareInspector,
    middlewareRestrictor(20, 3600, false),
    async (req, res) => {
        // Get metadata back by the code
        const metadata = utilCodeSession.
            getOne(req.body.session_id, req.body.code);

        if (metadata === null) {
            // Check metadata
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        } else {
            // Remove session
            utilCodeSession.
                deleteOne(req.body.session_id, req.body.code);
        }

        // Handle conflict
        const User = database.model("User", schemaUser);
        if (await User.findOne({email: metadata.email}).exec()) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        }

        // Handle creation
        const user = new User(metadata);
        const userData = await utilUser.saveData(user);

        // Generate token
        const token = utilSaraToken.issue(userData);

        // Send response
        res.
            header("Sara-Issue", token).
            sendStatus(StatusCodes.CREATED);
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/register", router);
};
