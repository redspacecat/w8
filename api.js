import { createClient } from "@supabase/supabase-js";
const fs = require("fs");
// console.time("login")
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// console.timeEnd("login")
// console.log("resetting...")
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
global.DOMParser = new JSDOM().window.DOMParser;

let api = {};

api.test = async function (request, reply) {
    reply.code(403).send("410");
};

api.getSite = async function (request, reply) {
    let siteName = request.params.name;
    // let sitePath = request.url.slice(siteName.length + 3);
    let sitePath = request.urlData("path").slice(siteName.length + 3);
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
                return reply.code(404).send("404 Not Found — That site doesn't exist");
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
    let b = { pages: pages, reply: reply, request: request, siteName: siteName, lastModified: data[0].lastModified };
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
            case sitePath.endsWith(".json"):
                type = "application/json";
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
            case sitePath.endsWith(".json"):
                type = "application/json";
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
    let cacheControl = b.request.query.new == "true" ? "no-cache" : "max-age=604800";
    if (type == "text/html") {
        let dom = new JSDOM(b.pages[path]);
        let els = dom.window.document.querySelectorAll("link, a, script");
        for (let el of els) {
            let attr = el.tagName == "SCRIPT" ? "src" : "href";
            if (el[attr]) {
                if (el.getAttribute(attr).startsWith("/")) {
                    el.setAttribute(attr, `/s/${b.siteName}${el.getAttribute(attr)}`);
                }
            }
        }
        b.reply.status(200).type(type).header("Cache-Control", cacheControl).send(dom.serialize());
    } else {
        b.reply.status(200).type(type).header("Cache-Control", cacheControl).send(b.pages[path]);
    }
}

api.page = function (p) {
    return function (request, reply) {
        return reply.view(`/${p}.html`);
    };
};

function slashUnescape(contents) {
    var replacements = { "\\\\": "\\", "\\n": "\n", '\\"': '"' };
    return contents.replace(/\\(\\|n|")/g, function (replace) {
        return replacements[replace];
    });
}

api.deploy = async function (request, reply) {
    // return reply.code(403).send("Site creations are disabled for now");
    if (!request.body.name || !request.body.files) {
        return reply.code(400).send("Malformed request");
    }
    let name = request.body.name;
    let password = request.body.password || "";
    let siteSize = new File([slashUnescape(JSON.stringify(request.body.files))], "text/plain").size;
    if (siteSize > 1000000) {
        return reply.code(400).send("Site too large! Max size: 1 megabyte");
    }
    if (name.length > 40 || name.length < 1) {
        return reply.code(400).send("Site name length disallowed");
    }
    name = name.replace(/[^a-zA-Z0-9_\-]/g, "");
    if (password.length > 40) {
        return reply.code(400).send("Password too long (limit: 40 characters)");
    }
    let data = await supabase.from("sites").select().eq("site_name", name);
    // console.log(data)
    if (data.data[0]) {
        return reply.code(409).send("A site with that name already exists");
    }
    console.log("adding data", name, "with data", request.body.files);
    console.time("addSite");
    await supabase.from("sites").insert([{ site_name: name, site_data: request.body.files, site_password: password || null }]);
    console.log("added data for site", name);
    console.timeEnd("addSite");
    return reply.code(200).send("Done!");
};

api.rateLimit = function (max, timeWindow) {
    return {
        config: {
            rateLimit: {
                max: max,
                timeWindow: timeWindow,
            },
        },
    };
};

api.editRequest = async function (request, reply) {
    if (!request.body.action) {
        return reply.code(400).send("Invalid");
    } else {
        if (request.body.action == "check") {
            if (!request.body.siteName || !request.body.sitePass) {
                return reply.code(400).send("Invalid");
            }
            let data = await supabase.from("sites").select().eq("site_name", request.body.siteName);
            if (!data.data[0]) {
                return reply.code(400).send("That site doesn't exist");
            } else {
                if (data.data[0].site_password == request.body.sitePass) {
                    return reply.code(200).send({ data: data.data[0].site_data });
                } else {
                    return reply.code(403).send("Unauthorized");
                }
            }
        } else if (request.body.action == "deploy") {
            let params = request.body;
            if (params.newName.length > 40 || params.newName.length < 1) {
                return reply.code(400).send("Site name length disallowed");
            }
            params.newName = params.newName.replace(/[^a-zA-Z0-9_\-]/g, "");

            let siteSize = new File([slashUnescape(JSON.stringify(params.files))], "text/plain").size;
            if (siteSize > 1000000) {
                return reply.code(400).send("Site too large! Max size: 1 megabyte");
            }

            let data = await supabase.from("sites").select().eq("site_name", request.body.oldName);
            if (!data.data[0]) {
                return reply.code(400).send("That site doesn't exist");
            } else {
                if (params.newName != params.oldName) {
                    let data3 = await supabase.from("sites").select().eq("site_name", request.body.newName);
                    if (data3.data[0]) {
                        return reply.code(400).send("The target site name already exists");
                    }
                }
                if (data.data[0].site_password == request.body.sitePass) {
                    let data2 = await supabase.from("sites").update({ site_name: params.newName, site_data: params.files }).eq("site_name", params.oldName);
                    let dirPrepend;
                    if (process.env.NODE_ENV == "dev") {
                        dirPrepend = "";
                        console.log("dev");
                    } else {
                        dirPrepend = "/";
                        console.log("prod");
                    }
                    try {
                        let data3 = fs.readFileSync(dirPrepend + "tmp/siteCache.json");
                        let cache = JSON.parse(data3);
                        if (cache[params.newName]) {
                            delete cache[params.newName];
                        }
                        fs.writeFileSync(dirPrepend + "tmp/siteCache.json", JSON.stringify(cache), { flag: "w" });
                        console.log("cache refreshed");
                    } catch (err) {
                        console.log("failed to refresh cache");
                    }
                    return reply.code(200).send("Updated!");
                } else {
                    return reply.code(403).send("Unauthorized");
                }
            }
        } else if (request.body.action == "delete") {
            let params = request.body;
            if (params.siteName && params.sitePass) {
                let data2 = await supabase.from("sites").select().eq("site_name", params.siteName);
                if (data2.data[0].site_password == params.sitePass) {
                    let data = await supabase.from("sites").delete().eq("site_name", params.siteName);

                    let dirPrepend;
                    if (process.env.NODE_ENV == "dev") {
                        dirPrepend = "";
                        console.log("dev");
                    } else {
                        dirPrepend = "/";
                        console.log("prod");
                    }
                    try {
                        let data3 = fs.readFileSync(dirPrepend + "tmp/siteCache.json");
                        let cache = JSON.parse(data3);
                        if (cache[params.newName]) {
                            delete cache[params.newName];
                        }
                        fs.writeFileSync(dirPrepend + "tmp/siteCache.json", JSON.stringify(cache), { flag: "w" });
                        console.log("cache refreshed");
                    } catch (err) {
                        console.log("failed to refresh cache");
                    }

                    return reply.code(200).send("Site deleted successfully");
                } else {
                    return reply.code(403).send("Unauthorized");
                }
            } else {
                return reply.code(400).send("Invalid");
            }
        }
    }
};

module.exports = api;
