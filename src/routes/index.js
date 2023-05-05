"use strict";

// Routers
exports.routerFiles = [
    "./admin.js",
    "./profile.js",
    "./swagger.js",
    "./token.js",
    "./user.js",
];

// Load routes
exports.load = () => {
    const routerMappers = exports.routerFiles.map((n) => require(n));
    routerMappers.forEach((c) => c());
};
