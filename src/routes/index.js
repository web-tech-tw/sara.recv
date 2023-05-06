"use strict";

// Routers
exports.routerFiles = [
    "./admin.js",
    "./swagger.js",
    "./tokens.js",
    "./users.js",
];

// Load routes
exports.load = () => {
    const routerMappers = exports.routerFiles.map((n) => require(n));
    routerMappers.forEach((c) => c());
};
