import { rewrite } from "@vercel/functions";

export default function middleware(request) {
    const url = new URL(request.url);
    const hostname = request.headers.get("host");
    console.log(url, hostname);

    if (hostname != "w8.quuq.dev" && !hostname.endsWith(".vercel.app") && !hostname.endsWith("localhost:3000")) {
        const newHost = hostname.replace(".w8.quuq.dev", "");
        const finalURL = `/s/${newHost}${url.pathname}?rewrote=true`;
        console.log(finalURL);
        return rewrite("https://w8.quuq.dev" + finalURL);
    } else {
        console.log("host", hostname);
        if (url.searchParams.has("rewrote")) {
            console.log("request has already been rewritten");
        } else {
            if (url.pathname.startsWith("/s/") && url.pathname.slice(3).length > 0) {
                console.log("request has not been rewritten already");
                console.log("redirecting to 404");
                url.pathname = "/404"
                return Response.redirect(url);
            }
        }
        console.log("doing nothing");
    }
}
