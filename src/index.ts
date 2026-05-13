import {Elysia} from "elysia";
import {cors} from "@elysiajs/cors";
import {swagger} from "@elysiajs/swagger";
import {
    runLoader,
    getMust,
    getFallback,
    getEnvironmentOverview,
} from "./config";
import {APP_NAME, APP_DESCRIPTION, APP_VERSION} from "./init/const";
import {prepare as prepareDatabase} from "./init/database";
import {tokensRoutes} from "./routes/tokens";
import {usersRoutes} from "./routes/users";
import {adminRoutes} from "./routes/admin";

// Load config
runLoader();

// Initialize application
export const app = new Elysia()
    .use(cors())
    .use(swagger({
        path: "/swagger",
        documentation: {
            info: {
                title: APP_NAME,
                description: APP_DESCRIPTION,
                version: APP_VERSION,
            },
        },
    }))
    .use(tokensRoutes)
    .use(usersRoutes)
    .use(adminRoutes)
    .get("/", ({set}) => {
        const redirectCode = getMust("INDEX_REDIRECT_TYPE") === "permanent" ?
            301 : 302;
        const redirectUrl = getMust("INDEX_REDIRECT_URL");

        set.status = redirectCode;
        set.redirect = redirectUrl;
    })
    .get("/robots.txt", ({set}) => {
        set.headers["content-type"] = "text/plain";
        return "User-agent: *\nDisallow: /";
    });

// Start server
const start = async () => {
    try {
        // Initialize database
        await prepareDatabase();
        console.info("Database connected");

        const port = parseInt(getFallback("HTTP_PORT", "8080"));
        const hostname = getFallback("HTTP_HOSTNAME", "0.0.0.0");

        app.listen({port, hostname}, ({hostname: h, port: p}) => {
            const {node, runtime} = getEnvironmentOverview();
            console.info("====");
            console.info(`${APP_NAME} (environment: ${node}, ${runtime})`);
            console.info(`Server is listening at http://${h}:${p}`);
            console.info("====");
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

if (import.meta.main) {
    start();
}
