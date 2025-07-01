import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let api = {}

api.test = async function (request, reply) {
    console.log(request.query.name)
    const { data } = await supabase.from("sites").select().eq("site_name", request.query.name);
    console.log(data)
    reply.send(data)
}

api.page = function (p) {
    return function (request, reply) {
        let params = {};
        return reply.view(`/${p}.hbs`, params);
    };
};

module.exports = api;