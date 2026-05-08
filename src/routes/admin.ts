import { Elysia, t } from "elysia";
import { authPlugin } from "../plugins/auth";
import User from "../models/user";

export const adminRoutes = new Elysia({ prefix: "/admin" })
    .use(authPlugin)
    /**
     * Get user by ID (Admin view)
     */
    .get("/users/:user_id", async ({ params, error }: any) => {
        const user = await User.findById(params.user_id).exec();
        if (!user) return error(404);

        return user.toObject();
    }, {
        access: "admin",
        params: t.Object({ user_id: t.String() })
    })
    /**
     * Add role to user
     */
    .post("/users/:user_id/roles", async ({ params, body, error }: any) => {
        const user = await User.findById(params.user_id).exec();
        if (!user) return error(404);

        if (!Array.isArray(user.roles)) {
            user.roles = [];
        }
        if (user.roles.includes(body.role_name)) {
            return error(409);
        }

        user.roles = [...user.roles, body.role_name];
        await user.save();

        return { message: "Role added" };
    }, {
        access: "admin",
        params: t.Object({ user_id: t.String() }),
        body: t.Object({ role_name: t.String() })
    })
    /**
     * Remove role from user
     */
    .delete("/users/:user_id/roles/:role_name", async ({ params, error }: any) => {
        const user = await User.findById(params.user_id).exec();
        if (!user) return error(404);

        if (!Array.isArray(user.roles) || !user.roles.includes(params.role_name)) {
            return error(410); // GONE
        }

        user.roles = user.roles.filter((name) => name !== params.role_name);
        await user.save();

        return { message: "Role removed" };
    }, {
        access: "admin",
        params: t.Object({ 
            user_id: t.String(),
            role_name: t.String()
        })
    });
