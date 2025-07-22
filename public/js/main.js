window.addEventListener("DOMContentLoaded", function () {
    // add vercel analytics
    window.va =
        window.va ||
        function () {
            (window.vaq = window.vaq || []).push(arguments);
        };
    let s2 = document.createElement("script");
    s2.src = "/_vercel/insights/script.js";
    s2.defer = true;
    document.head.appendChild(s2);
});
