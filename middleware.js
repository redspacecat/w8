import { rewrite } from "@vercel/functions";

export default function middleware(request) {
    const url = new URL(request.url);
    const hostname = request.headers.get("host");
    console.log(url, hostname);

    let siteHost = process.env.PROD_SITE_HOSTNAME
    let siteProtocol = "https://"
    let sitePort = ""
    if (process.env.NODE_ENV == "development") {
        console.log('hi')
        siteHost = "localhost"
        sitePort = ":3000"
        siteProtocol = "http://"
    }
    console.log(siteHost, sitePort)
    if (hostname != siteHost && !hostname.endsWith(".vercel.app") && !hostname.endsWith(".localhost")) {
        const newHost = hostname.replace(`.${siteHost + sitePort}`, "");
        const finalURL = `/s/${newHost}${url.pathname}?${process.env.MIDDLEWARE_REWRITE_TOKEN}=true`;
        console.log(finalURL);
        return rewrite(siteProtocol + siteHost + sitePort + finalURL);
    } else {
        console.log("host", hostname);
        if (url.searchParams.has(process.env.MIDDLEWARE_REWRITE_TOKEN)) {
            console.log("request has already been rewritten");
        } else {
            if (url.pathname.startsWith("/s/") && url.pathname.slice(3).length > 0) {
                console.log("request has not been rewritten already");
                console.log("redirecting to 404");
                return Response.redirect(new URL(url.origin + "/404"));
            }
        }
        console.log("doing nothing");
    }
}
