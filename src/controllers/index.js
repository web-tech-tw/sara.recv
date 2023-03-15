"use strict";

// Routes
const routes = [
    require("./login"),
    require("./profile"),
    require("./register"),
    require("./token"),
    require("./user"),
];

// Load routes
module.exports = () => {
    routes.forEach((c) => c());
};
