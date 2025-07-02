import { createClient } from "@supabase/supabase-js";
const fs = require("fs");
// console.time("login")
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// console.timeEnd("login")
// console.log("resetting...")

let api = {};

api.test = async function (request, reply) {
    reply.send("ok");
};

api.getSite = async function (request, reply) {
    let siteName = request.params.name
    let sitePath = request.url.slice(siteName.length + 3)
    if (sitePath == "") {
        // sitePath = "/"
        return reply.redirect(`/s/${siteName}/`)
    }
    console.log("siteName", siteName)
    console.log("sitePath", sitePath)
    // reply.send(sitePath)

    let data
    let cache = {}
    let usedCache = false
    let dirPrepend
    if (process.env.NODE_ENV == "dev") {
        dirPrepend = ""
        console.log("dev")
    } else {
        dirPrepend = "/"
        console.log("prod")
    }

    try {
        if (request.query.new == "true") {
            throw {code: "ENOENT"}
        }
        data = fs.readFileSync(dirPrepend + "tmp/siteCache.json");
        console.log("using cached data")
        cache = JSON.parse(data)
        data = cache[siteName]
        usedCache = true
    } catch (err) {
        if (err.code === "ENOENT") {
            if (request.query.new == "true") {
                console.log("getting fresh data")
            } else {
                console.log("site cache not found");
            }
            // console.log("siteName", siteName);
            data = await supabase.from("sites").select().eq("site_name", siteName);
            data = data.data
            console.log("requested updated data", data)
        } else {
            throw err;
        }
    }

    cache[siteName] = data
    if (!usedCache) {
        console.log("writing cache", cache)
        fs.writeFileSync(dirPrepend + "tmp/siteCache.json", JSON.stringify(cache), {flag: "w"})
    } else {
        console.log("not writing cache")
    }

    let pages = data[0].site_data
    let b = {pages: pages, reply: reply}
    if (sitePath == "/" && pages["index.html"]) {
        // reply.status(200).type("text/html").send(pages["index.html"])
        return returnPage(b, "text/html", "index.html")
    } else if (pages[sitePath]) {
        // reply.status(200).type("text/html").send(pages[sitePath])
        let type
        switch (true) {
            case sitePath.endsWith(".css"):
                type = "text/css"
                break
            case sitePath.endsWith(".js"):
                type = "application/javascript"
                break
            case sitePath.endsWith(".html"):
                type = "text/html"
                break
            default:
                break
        }
        return returnPage(b, type, sitePath)
    } else if (pages[sitePath.slice(1)]) {
        // reply.status(200).type("text/html").send(pages[sitePath.slice(1)])
        let type
        switch (true) {
            case sitePath.endsWith(".css"):
                type = "text/css"
                break
            case sitePath.endsWith(".js"):
                type = "application/javascript"
                break
            case sitePath.endsWith(".html"):
                type = "text/html"
                break
            default:
                break
        }
        return returnPage(b, type, sitePath.slice(1))
    } else if (pages[sitePath + ".html"]) {
        // reply.status(200).type("text/html").send(pages[sitePath + ".html"])
        return returnPage(b, "text/html", sitePath + ".html")
    } else {
        reply.status(404).send("404 Not Found")
    }

    reply.send(data)
};

function returnPage(b, type, path) {
    b.reply.status(200).type(type).send(b.pages[path])
}

api.page = function (p) {
    return function (request, reply) {
        let params = {};
        return reply.view(`/${p}.hbs`, params);
    };
};

module.exports = api;
