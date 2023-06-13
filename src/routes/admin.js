"use strict";

const {StatusCodes} = require("http-status-codes");
const {useApp, express} = require("../init/express");

const User = require("../models/user");

const utilUser = require("../utils/user");

const middlewareAccess = require("../middleware/access");
const middlewareInspector = require("../middleware/inspector");
const middlewareValidator = require("express-validator");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.json());

/**
 * @openapi
 * /admin/users/{user_id}:
 *   get:
 *     summary: Get user by ID
 *     description: Get user information by ID
 *     tags:
 *       - admin
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: user_id
 *         in: path
 *         description: ID of the user to retrieve
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get("/users/:user_id",
    middlewareAccess("admin"),
    middlewareValidator.param("user_id").isMongoId().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        // Check user exists by the ID
        const user = await User.findById(req.query.user_id).exec();

        // Send response
        if (!user) {
            res.send(user);
        } else {
            res.sendStatus(StatusCodes.NOT_FOUND);
        }
    },
);

/**
 * @openapi
 * /admin/users/{user_id}/roles:
 *   post:
 *     summary: Add role to user
 *     description: Add a role to a user by ID
 *     tags:
 *       - admin
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_name:
 *                 type: string
 *     parameters:
 *       - name: user_id
 *         in: path
 *         description: ID of the user to whom the role will be added
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *     responses:
 *       201:
 *         description: Role added successfully
 *       404:
 *         description: User not found
 *       409:
 *         description: Role already exists for this user
 */
router.post("/users/:user_id/roles",
    middlewareAccess("admin"),
    middlewareValidator.param("user_id").isMongoId().notEmpty(),
    middlewareValidator.body("role_name").isString().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        // Check user exists by the ID
        const user = await User.findById(req.params.user_id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Update values
        if (!Array.isArray(user?.roles)) {
            user.roles = [req.body.role];
        } else if (user.roles.includes(req.body.role)) {
            res.sendStatus(StatusCodes.CONFLICT);
            return;
        } else {
            user.roles.push(req.body.role);
        }
        await utilUser.saveData(user);

        // Send response
        res.sendStatus(StatusCodes.CREATED);
    },
);

/**
 * @openapi
 * /admin/users/{user_id}/roles/{role_name}:
 *   delete:
 *     summary: Remove role from user
 *     description: Remove a role from a user by ID
 *     tags:
 *       - admin
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         schema:
 *           type: string
 *           format: objectId
 *         required: true
 *         description: The user ID
 *       - in: path
 *         name: role_name
 *         schema:
 *           type: string
 *         required: true
 *         description: The role name
 *     responses:
 *       204:
 *         description: Role removed successfully
 *       404:
 *         description: User not found or role not found
 *       410:
 *         description: Role does not exist for this user
 */
router.delete("/users/:user_id/roles/:role_name",
    middlewareAccess("admin"),
    middlewareValidator.param("user_id").isMongoId().notEmpty(),
    middlewareValidator.param("role_name").isString().notEmpty(),
    middlewareInspector,
    async (req, res) => {
        // Check user exists by the ID
        const user = await User.findById(req.params.user_id).exec();
        if (!user) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        // Update values
        if (
            Array.isArray(user?.roles) &&
            user.roles.includes(req.params.role_name)
        ) {
            const index = user.roles.indexOf(req.params.role_name);
            user.roles.splice(index, 1);
        } else {
            res.sendStatus(StatusCodes.GONE);
            return;
        }
        await utilUser.saveData(user);

        // Send response
        res.sendStatus(StatusCodes.NO_CONTENT);
    },
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/admin", router);
};
