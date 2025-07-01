import { createClient } from "@supabase/supabase-js";
const fs = require("fs");
// console.time("login")
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// console.timeEnd("login")
// console.log("resetting...")

let api = {};

api.test = async function (request, reply) {
    console.log(request.query.name);
    const { data } = await supabase.from("sites").select().eq("site_name", request.query.name);
    console.log(data);
    reply.send(data);
};

api.getSite = async function (request, reply) {
    let data
    let everything = {}
    let usedCache = false
    try {
        if (request.query.new == "true") {
            throw {code: "ENOENT"}
        }
        data = fs.readFileSync(/*__dirname + */"/tmp/siteCache.json");
        console.log("using cached data")
        everything = JSON.parse(data)
        data = everything[request.params.name]
        usedCache = true
    } catch (err) {
        if (err.code === "ENOENT") {
            if (request.query.new == "true") {
                console.log("getting fresh data")
            } else {
                console.log("site cache not found");
            }
            console.log(request.params.name);
            data = await supabase.from("sites").select().eq("site_name", request.params.name);
            data = data.data
            console.log("requested updated data", data)
        } else {
            throw err;
        }
    }

    everything[request.params.name] = data
    if (!usedCache) {
        console.log("writing cache", everything)
        fs.writeFileSync(/*__dirname + */"/tmp/siteCache.json", JSON.stringify(everything), {flag: "w"})
    } else {
        console.log("not writing cache")
    }

    reply.send(data)
};

api.page = function (p) {
    return function (request, reply) {
        let params = {};
        return reply.view(`/${p}.hbs`, params);
    };
};

module.exports = api;
