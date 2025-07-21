import { rewrite } from "@vercel/functions";

export default function middleware(request) {
    const url = new URL(request.url);
    const hostname = request.headers.get("host");
    console.log(url, hostname);

    if (hostname != "w8.quuq.dev" && !hostname.endsWith(".vercel.app")) {
        const newHost = hostname.replace(".w8.quuq.dev", "");
        const finalURL = `/s/${newHost}${url.pathname}`;
        console.log(finalURL);
        return rewrite("https://w8.quuq.dev" + finalURL);
    } else {
        if (url.pathname.startsWith("/s/") && url.pathname.slice(3).length > 0) {
            return Response.redirect(`https://${url.pathname.slice(3)}.w8.quuq.dev`)
        }
    }
}