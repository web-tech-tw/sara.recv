"use strict";
// swagger is an api documentation generator (OpenAPI spec.)

// Import modules
const {getMust} = require("../config");

const {
    APP_NAME,
    APP_DESCRIPTION,
    APP_VERSION,
    APP_AUTHOR_NAME,
    APP_AUTHOR_URL,
} = require("./const");

const {join: pathJoin} = require("node:path");

const swaggerJSDoc = require("swagger-jsdoc");
const toDocSchema = require("mongoose-to-swagger");

const {routerFiles} = require("../routes");
const {modelFiles} = require("../models");

const routerFilePathPrefix = pathJoin(__dirname, "..", "routes");
const modelFilePathPrefix = pathJoin(__dirname, "..", "models");

// Config options
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
                XaraToken: {
                    type: "apiKey",
                    in: "header",
                    name: "Authorization",
                },
            },
            schemas: Object.fromEntries(modelFiles.map(
                (f) => {
                    const filename = pathJoin(modelFilePathPrefix, f);
                    const model = require(filename);
                    const schema = toDocSchema(model);
                    return [schema.title, schema];
                },
            )),
        },
    },
    apis: routerFiles.map(
        (f) => pathJoin(routerFilePathPrefix, f),
    ),
};

// Export as useFunction
exports.useApiDoc = () => swaggerJSDoc(options);
