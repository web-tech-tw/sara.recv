import {Elysia} from "elysia";
import * as xaraToken from "../utils/xara_token";
import * as testTokenAuth from "../utils/test_token";
import {isProduction} from "../config";
import {isObjectPropExists} from "../utils/native";

const authMethods: Record<string, (token: string) => Promise<any>> = {
    "XARA": xaraToken.validate,
    "TEST": (token: string) => Promise.resolve(testTokenAuth.validate(token)),
};

export interface AuthContext {
    id: string;
    metadata: any;
    method: string;
    secret: string;
}

export const authPlugin = new Elysia({name: "auth"})
    .derive({as: "global"}, async ({
        headers,
    }): Promise<{ auth: AuthContext | null }> => {
        const authHeader = headers["authorization"];
        if (!authHeader) return {auth: null};

        const params = authHeader.split(" ");
        if (params.length !== 2) return {auth: null};

        const [method, secret] = params;
        if (!isObjectPropExists(authMethods, method)) {
            return {auth: null};
        }

        const validateFn = authMethods[method];
        const result = await validateFn(secret);

        if (!isProduction()) {
            console.warn("An authentication detected:", method, result);
        }

        if (result.isAborted) {
            return {auth: null};
        }

        return {
            auth: {
                id: result.userId as string,
                metadata: result.payload as any,
                method,
                secret,
            },
        };
    })
    .macro(({onBeforeHandle}) => ({
        access(requiredRole: string | null) {
            onBeforeHandle(({auth, status}: any) => {
                if (!auth || !auth.id) {
                    return status(401);
                }

                if (
                    auth.method !== "XARA" &&
                    !(auth.method === "TEST" && !isProduction())
                ) {
                    return status(405);
                }

                const userRoles = auth.metadata?.profile?.roles;
                const isUserRolesValid = Array.isArray(userRoles);

                if (requiredRole &&
                    (!isUserRolesValid || !userRoles.includes(requiredRole))) {
                    return status(403);
                }
            });
        },
    }));
