let files = {
    "index.html": `<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <h2>Hello, world!</h2>
    <script src="js/main.js"></script>
</body>
</html>`,
    "css/style.css": `body {
    font-family: Arial;
}`,
    "js/main.js": `window.addEventListener("click", function() {
    alert("Hi, world!");
})`,
};
let currentFile = Object.keys(files)[0];

window.addEventListener("DOMContentLoaded", setup);
window.addEventListener("cmstatechange", function () {
    saveFile();
    createSite();
});

window.addEventListener("resize", function () {
    document.documentElement.style.setProperty("--hierarchy-width", getComputedStyle(document.querySelector("#files")).width);
});

window.addEventListener("message", function (msg, origin) {
    console.log(msg, origin);
    if (msg.data.loadPage) {
        loadPage(msg.data.loadPage);
    }
});

function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setup() {
    let params = new URLSearchParams(location.search);
    window.edit = params.has("edit");
    if (edit) {
        await sleep(100);
        if (params.get("edit")) {
            window.siteName = params.get("edit");
        } else {
            // siteName = prompt("Enter the name of the site to edit")
            await Swal.fire({
                title: "Enter the name of the site to edit",
                input: "text",
                confirmButtonText: "Next",
                showLoaderOnConfirm: false,
                preConfirm: (name) => {
                    window.siteName = name;
                },
                allowOutsideClick: false,
            });
        }
        console.log(siteName);
        await Swal.fire({
            title: `Enter the password of the site: ${siteName}`,
            input: "text",
            confirmButtonText: "Edit",
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async (pass) => {
                window.sitePass = pass;
                let response = await fetch("/app/edit", {
                    method: "POST",
                    body: JSON.stringify({
                        action: "check",
                        siteName: siteName,
                        sitePass: sitePass,
                    }),
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                let text = await response.text();
                if (response.ok) {
                    let json = JSON.parse(text);
                    files = json.data;
                    document.querySelector("#site-name").value = siteName;
                    document.querySelector("#deploy-text").innerText = "Save Changes";
                } else {
                    // alert("Error: " + text);
                    // window.edit = false
                    // document.querySelector("#site-name").value = `new-site-${getRandomInt(1, 100000)}`;
                    await Swal.fire({
                        title: "Error",
                        text: text,
                        icon: "error",
                    });
                    window.location.search = "";
                }
            },
        });
    } else {
        document.querySelector("#site-name").value = `new-site-${getRandomInt(1, 100000)}`;
    }
    document.querySelector(".deployButton").addEventListener("click", handleDeploy);
    createHierarchy(files);
    loadFile(currentFile);
    createSite();
    document.documentElement.style.setProperty("--hierarchy-width", getComputedStyle(document.querySelector("#files")).width);
}

function createSite() {
    loadPage("index.html");
}

function loadPage(path) {
    let file = files[path];
    let dom = new DOMParser().parseFromString(file, "text/html");
    let els = dom.querySelectorAll("link, a, script");
    for (let el of els) {
        let attr = el.tagName == "SCRIPT" ? "src" : "href";
        if (el[attr]) {
            if (el.getAttribute(attr).startsWith("/")) {
                el.setAttribute(attr, el.getAttribute(attr).slice(1));
            }
            if (el.tagName == "A") {
                el[attr] = `javascript:window.top.postMessage({loadPage: \`${el.getAttribute(attr)}\`}, "*")`;
            } else {
                let fileBlob = new Blob([files[el.getAttribute(attr)]], { type: el.getAttribute(attr).endsWith(".css") ? "text/css" : el.getAttribute(attr).endsWith(".js") ? "application/javascript" : "text/html" });
                el[attr] = URL.createObjectURL(fileBlob);
            }
        }
    }
    document.querySelector("#preview").src = URL.createObjectURL(new Blob([dom.documentElement.outerHTML], { type: "text/html" }));
}

function saveFile() {
    files[currentFile] = view.state.doc.toString();
}

function loadFile(path) {
    currentFile = path;
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: files[path] },
    });

    let targetLang;
    switch (true) {
        case path.endsWith(".html"):
            targetLang = "html";
            break;
        case path.endsWith(".js"):
            targetLang = "js";
            break;
        case path.endsWith(".css"):
            targetLang = "css";
            break;
        default:
            return;
    }
    view.dispatch({
        effects: cm6.makeLanguageConf(targetLang),
    });
}

let block = document.querySelector("#editor");
let block2 = document.querySelector("#files");
let preview = document.querySelector("#preview");
let slider = document.querySelector(".slider");
let slider2 = document.querySelector(".slider2");

function getProp(el, prop) {
    return parseFloat(getComputedStyle(el)[prop].replace("px", ""));
}

slider.onmousedown = function dragMouseDown(e) {
    let dragX = e.clientX;
    preview.style.pointerEvents = "none";
    document.onmousemove = function onMouseMove(e) {
        if (getProp(slider, "left") - getProp(slider2, "left") > 100) {
            block.style.width = getProp(block, "width") + e.clientX - dragX + "px";
            slider.style.left = getProp(slider, "left") + e.clientX - dragX + "px";
            dragX = e.clientX;
        } else if (e.clientX - dragX > 0) {
            block.style.width = getProp(block, "width") + e.clientX - dragX + "px";
            slider.style.left = getProp(slider, "left") + e.clientX - dragX + "px";
            dragX = e.clientX;
        }
        // block.style.width = `${getProp(block, "width") / getProp(document.querySelector("#wrapper"), "width") * 100}%`
        // slider.style.left = block.style.width
    };
    // remove mouse-move listener on mouse-up
    document.onmouseup = function () {
        document.onmousemove = document.onmouseup = null;
        preview.style.pointerEvents = "";
    };
};

slider2.onmousedown = function dragMouseDown(e) {
    let dragX = e.clientX;
    document.onmousemove = function onMouseMove(e) {
        if (getProp(slider, "left") - getProp(slider2, "left") > 100) {
            block2.style.width = getProp(block2, "width") + e.clientX - dragX + "px";
            document.documentElement.style.setProperty("--hierarchy-width", block2.style.width);
            block.style.width = getProp(block, "width") - (e.clientX - dragX) + "px";
            slider2.style.left = getProp(slider2, "left") + e.clientX - dragX + "px";
            dragX = e.clientX;
        } else if (e.clientX - dragX < 0) {
            block2.style.width = getProp(block2, "width") + e.clientX - dragX + "px";
            document.documentElement.style.setProperty("--hierarchy-width", block2.style.width);
            block.style.width = getProp(block, "width") - (e.clientX - dragX) + "px";
            slider2.style.left = getProp(slider2, "left") + e.clientX - dragX + "px";
            dragX = e.clientX;
        }
        // block2.style.width = `${getProp(block2, "width") / getProp(document.querySelector("#wrapper"), "width") * 100}%`
        // block.style.width = `${getProp(block, "width") / getProp(document.querySelector("#wrapper"), "width") * 100}%`
    };
    // remove mouse-move listener on mouse-up
    document.onmouseup = function () {
        document.onmousemove = document.onmouseup = null;
    };
};

function newFile() {
    Swal.fire({
        title: "New File",
        showClass: {
            popup: `
      animate__animated
      animate__fadeInUp
      animate__faster
    `,
        },
        hideClass: {
            popup: `
      animate__animated
      animate__fadeOutDown
      animate__faster
    `,
        },
        text: "Enter a valid file name",
        footer: "To make the file be in a folder, add slashes <code style='background-color: #e9e9ed;border-radius:3px;padding:2px'>/</code><br>For example, <code style='background-color: #e9e9ed;border-radius:3px;padding:2px'>assets/js/app.js</code>",
        input: "text",
        inputAttributes: {
            autocapitalize: "off",
        },
        showCancelButton: true,
        confirmButtonText: "Create",
        preConfirm: function (path) {
            if (path.startsWith("/")) {
                path = path.slice(1);
            }
            if (!path) {
                Swal.showValidationMessage("A file name is required");
            }
            if (path.endsWith(".html") || path.endsWith(".css") || path.endsWith(".js")) {
                files[path] = "";
                saveFile();
                currentFile = path;
                loadFile(currentFile);
                createHierarchy(files);
            } else {
                Swal.showValidationMessage("Only .html, .css, and .js file formats supported");
            }
        },
    });
}

async function handleDeploy(e) {
    e.preventDefault();
    if (document.querySelector(".deployButton").dataset.disabled) {
        return;
    }
    // submitPost("/app/deploy", {name: document.querySelector("#site-name").value, data: JSON.stringify(files)})
    // let deployWindow = window.open("/app/deploy", "_blank")
    // deployWindow.addEventListener("DOMContentLoaded", function() {
    //     deployWindow.document.getElementById("name").innerText = document.querySelector("#site-name").value
    //     deployWindow.document.getElementById("files").innerText = JSON.stringify(files)
    // })
    saveFile();
    if (window.edit) {
        console.log("saving changes");
        let newName = document.querySelector("#site-name").value;
        const escapeHtml = (unsafe) => {
            return unsafe.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
        };
        if (siteName != newName) {
            let result = await Swal.fire({
                title: "Confirm site name change",
                html: `Are you sure you want to change the name from <b>${escapeHtml(siteName)}</b> to <b>${escapeHtml(newName)}</b>?`,
                showCancelButton: true,
                confirmButtonText: "Continue",
                icon: "question",
            });
            if (!result.isConfirmed) {
                document.querySelector(".deployButton").dataset.disabled = false;
                document.querySelector("#deploy-text").innerText = "Save Changes";
                return;
            }
        }
        document.querySelector("#deploy-text").innerText = "Saving...";
        document.querySelector(".deployButton").dataset.disabled = true;
        let response = await fetch("/app/edit", {
            method: "POST",
            body: JSON.stringify({
                action: "deploy",
                oldName: siteName,
                newName: newName,
                files: files,
                sitePass: sitePass,
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        history.replaceState({}, "", location.origin + location.pathname + `?edit=${newName}`);
        await sleep(500);
        document.querySelector(".deployButton").dataset.disabled = false;
        document.querySelector("#deploy-text").innerText = "Save Changes";
        if (response.ok) {
            siteName = newName;
            Swal.fire({
                icon: "success",
                html: `Your site has been updated! You can find the updated version at <a target="_blank" href="/s/${escapeHtml(newName)}">${location.origin}/s/${escapeHtml(newName)}`,
            });
        } else {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: await response.text(),
            });
        }
    } else {
        window.open(
            `/app/deploy#${URL.createObjectURL(new Blob([JSON.stringify({ files: files, name: document.querySelector("#site-name").value })], { type: "application/json" }))
                .split("/")
                .at(-1)}`,
            "_blank"
        );
    }
}
