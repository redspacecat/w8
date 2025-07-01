const path = require("path");
const api = require("../api.js");
console.log("hello world")

const app = require("fastify")({
    ignoreTrailingSlash: true,
});
async function main() {
    await app.register(import("@fastify/rate-limit"), { global: true, max: 30, timeWindow: 60 * 1000 });

    // Setup our static files
    app.register(require("@fastify/static"), {
        root: path.join(__dirname, "public"),
        prefix: "/", // optional: default '/'
    });

    app.register(require("@fastify/view"), {
        engine: {
            handlebars: require("handlebars"),
        },
        root: path.join(__dirname, "views"),
    });

    app.get("/", api.page("main"));
    app.get("/test", api.test)
    app.get("/s/:name", api.getSite)

    app.listen({ port: process.env.PORT, host: "0.0.0.0" }, function (err, address) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`Your app is listening on ${address}`);
    });
}
main();

export default async function handler(req, res) {
    await app.ready();
    app.server.emit("request", req, res);
}
