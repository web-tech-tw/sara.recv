"use strict";

const {getEnabled, getMust} = require("../config");

const {
    APP_NAME,
    APP_DESCRIPTION,
    APP_VERSION,
    APP_AUTHOR_NAME,
    APP_AUTHOR_URL,
} = require("../init/const");

const {useApp, express} = require("../init/express");
const {join: pathJoin} = require("path");

const {routerFiles} = require("./index");
const {modelFiles} = require("../models");

const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const toDocSchema = require("mongoose-to-swagger");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: APP_NAME,
            version: APP_VERSION,
            description: APP_DESCRIPTION,
            contact: {
                name: APP_AUTHOR_NAME,
                url: APP_AUTHOR_URL,
            },
        },
        servers: [{
            description: getMust("SWAGGER_SERVER_DESCRIPTION"),
            url: getMust("SWAGGER_SERVER_URL"),
        }],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: "apiKey",
                    in: "header",
                    name: "Authorization",
                },
            },
            schemas: Object.fromEntries(modelFiles.map(
                (f) => {
                    const filename = pathJoin(__dirname, "../models", f);
                    const model = require(filename);
                    const schema = toDocSchema(model);
                    return [schema.title, schema];
                },
            )),
        },
    },
    apis: routerFiles.map(
        (f) => pathJoin(__dirname, f),
    ),
};

const openapiSpecification = swaggerJSDoc(options);

const {Router: newRouter} = express;
const router = newRouter();

router.use("/", swaggerUi.serve, swaggerUi.setup(openapiSpecification));

// Export routes mapper (function)
module.exports = () => {
    // Skip if swagger disabled
    if (!getEnabled("ENABLED_SWAGGER")) {
        return;
    }

    // Use application
    const app = useApp();

    // Mount the router
    app.use("/swagger", router);
};
