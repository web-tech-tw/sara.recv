"use strict";

// Routes
const routes = [
    require("./login"),
    require("./profile"),
    require("./register"),
    require("./admin"),
];

// Load routes
module.exports = () => {
    routes.forEach((c) => c());
};
