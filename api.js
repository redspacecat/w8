import { createClient } from "@supabase/supabase-js";
const fs = require("fs");
// console.time("login")
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// console.timeEnd("login")
// console.log("resetting...")
const jsdom = require("jsdom")
const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser

let api = {};

api.test = async function (request, reply) {
    reply.code(403).send("410");
};

api.getSite = async function (request, reply) {
    let siteName = request.params.name;
    let sitePath = request.url.slice(siteName.length + 3);
    if (sitePath == "") {
        // sitePath = "/"
        return reply.redirect(`/s/${siteName}/`);
    }
    console.log("siteName", siteName);
    console.log("sitePath", sitePath);
    // reply.send(sitePath)

    let data;
    let cache = {};
    let usedCache = false;
    let dirPrepend;
    if (process.env.NODE_ENV == "dev") {
        dirPrepend = "";
        console.log("dev");
    } else {
        dirPrepend = "/";
        console.log("prod");
    }

    try {
        if (request.query.new == "true") {
            throw { code: "ENOENT" };
        }
        data = fs.readFileSync(dirPrepend + "tmp/siteCache.json");
        console.log("using cached data", data);
        cache = JSON.parse(data);
        console.log(cache);
        data = cache[siteName];
        if (data) {
            usedCache = true;
        } else {
            throw { code: "ENOENT" };
        }
    } catch (err) {
        if (err.code === "ENOENT") {
            if (request.query.new == "true") {
                console.log("getting fresh data");
            } else {
                console.log("site cache not found");
            }
            // console.log("siteName", siteName);
            data = await supabase.from("sites").select().eq("site_name", siteName);
            console.log("test", data);
            data = data.data;
            if (!data[0]) {
                return reply.code(404).send("404 Not Found — That site doesn't exist")
            }
            console.log("requested updated data", data);
        } else {
            throw err;
        }
    }

    cache[siteName] = data;
    if (!usedCache) {
        console.log("writing cache", cache);
        fs.writeFileSync(dirPrepend + "tmp/siteCache.json", JSON.stringify(cache), { flag: "w" });
    } else {
        console.log("not writing cache");
    }

    console.log(data);
    let pages = data[0].site_data;
    let b = { pages: pages, reply: reply, siteName: siteName };
    // console.log(sitePath + ".html")
    if (sitePath == "/" && pages["index.html"]) {
        // reply.status(200).type("text/html").send(pages["index.html"])
        return returnPage(b, "text/html", "index.html");
    } else if (pages[sitePath]) {
        // reply.status(200).type("text/html").send(pages[sitePath])
        let type;
        switch (true) {
            case sitePath.endsWith(".css"):
                type = "text/css";
                break;
            case sitePath.endsWith(".js"):
                type = "application/javascript";
                break;
            case sitePath.endsWith(".html"):
                type = "text/html";
                break;
            default:
                break;
        }
        return returnPage(b, type, sitePath);
    } else if (pages[sitePath.slice(1)]) {
        // reply.status(200).type("text/html").send(pages[sitePath.slice(1)])
        let type;
        switch (true) {
            case sitePath.endsWith(".css"):
                type = "text/css";
                break;
            case sitePath.endsWith(".js"):
                type = "application/javascript";
                break;
            case sitePath.endsWith(".html"):
                type = "text/html";
                break;
            default:
                break;
        }
        return returnPage(b, type, sitePath.slice(1));
    } else if (pages[sitePath + ".html"]) {
        // reply.status(200).type("text/html").send(pages[sitePath + ".html"])
        return returnPage(b, "text/html", sitePath + ".html");
    } else if (pages[sitePath.slice(1) + ".html"]) {
        // reply.status(200).type("text/html").send(pages[sitePath + ".html"])
        return returnPage(b, "text/html", sitePath.slice(1) + ".html");
    } else {
        reply.status(404).send(`404 Not Found — The resource ${sitePath} was not found`);
    }

    reply.send(data);
};

function returnPage(b, type, path) {
    if (type == "text/html") {
        let dom = new DOMParser().parseFromString(b.pages[path], "text/html");
        let els = dom.querySelectorAll("link, a, script");
        for (let el of els) {
            let attr = el.tagName == "SCRIPT" ? "src" : "href";
            if (el[attr]) {
                if (el.getAttribute(attr).startsWith("/")) {
                    el.setAttribute(attr, `/s/${b.siteName}${el.getAttribute(attr)}`);
                }
            }
        }
        b.reply.status(200).type(type).send(dom.documentElement.outerHTML);
    } else {
        b.reply.status(200).type(type).send(b.pages[path]);
    }
}

api.page = function (p) {
    return function (request, reply) {
        let params = {};
        return reply.view(`/${p}.hbs`, params);
    };
};

module.exports = api;
