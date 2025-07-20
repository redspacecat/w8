import { rewrite } from "@vercel/functions";

export default function middleware(request) {
    const url = new URL(request.url);
    const hostname = request.headers.get("host");
    console.log(url, hostname);

    if (hostname != "w8.quuq.dev") {
        const newHost = hostname.replace(".w8.quuq.dev", "");
        const finalURL = `/s/${newHost}${url.pathname}`;
        console.log(finalURL);
        return rewrite("https://w8.quuq.dev" + finalURL);
    }
}