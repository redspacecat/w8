const path = require("path");
const api = require("../api.js");

const app = require("fastify")({
    ignoreTrailingSlash: true,
});
async function main() {
    await app.register(require("@fastify/rate-limit"), {
        global: true,
        max: 30,
        timeWindow: 60 * 1000
    });

    app.register(require('@fastify/url-data'))
    
    // Setup our static files
    app.register(require("@fastify/static"), {
        root: path.join(__dirname, "public"),
        prefix: "/", // optional: default '/'
    });
    
    app.register(require("@fastify/view"), {
        engine: {
            handlebars: require("handlebars"),
        },
        root: path.join(__dirname, "pages"),
    });

    // app.register(require('@fastify/formbody'))
    
    app.get("/", api.page("main"));
    app.get("/test", api.test);

    ["/s/:name/*", "/s/:name"].forEach((path) => {
        app.get(path, api.getSite);
    });

    app.get("/editor", async function (request, reply) {
        if (!Object.keys(request.query).includes("edit")) {
            return reply.redirect("/")
        } else {
            return reply.view("/editor.html")
        }
    });
    app.get("/create", api.page("deploy"))
    app.post("/deploy", api.rateLimit(1, 3600000), api.deploy)
    app.post("/edit", api.rateLimit(2, 60000), api.editRequest)
    app.get("/terms", api.page("terms"))

    app.setNotFoundHandler(function (request, reply) {
        reply.code(404).send("404 Not Found")
    })

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
