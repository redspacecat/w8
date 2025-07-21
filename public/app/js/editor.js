let files = {
    "index.html": `<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="css/style.css">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
let previewPage = currentFile;
let blobURLS = [];
let originalURLS = [];
let updatePreviewTimeout;
let updatePreviewWaitTime = 400;
let logs = [];

const beforeUnloadHandler = (event) => {
    // Recommended
    event.preventDefault();

    // Included for legacy support, e.g. Chrome/Edge < 119
    event.returnValue = true;
};

let settings = new Proxy(
    {},
    {
        set: function (target, key, value) {
            console.log(`${key} set to ${value}`);
            if (key == "unsavedChanges") {
                if (value) {
                    window.addEventListener("beforeunload", beforeUnloadHandler);
                } else {
                    window.removeEventListener("beforeunload", beforeUnloadHandler);
                }
            }
            target[key] = value;
            return true;
        },
    }
);

window.addEventListener("DOMContentLoaded", setup);
window.addEventListener("cmstatechange", function () {
    if (updatePreviewTimeout) {
        clearTimeout(updatePreviewTimeout);
    }
    updatePreviewTimeout = setTimeout(createSite, updatePreviewWaitTime);
    saveFile();
    settings.unsavedChanges = true;
});

window.addEventListener("resize", function () {
    document.documentElement.style.setProperty("--hierarchy-width", getComputedStyle(document.querySelector("#files")).width);
});

window.addEventListener("message", function (msg, origin) {
    console.log(msg, origin);
    if (msg.data.l) {
        loadPage(msg.data.l, true);
    } else if (msg.data.action == "console") {
        console.log("message from iframe console", msg.data.type, msg.data.data, msg.data.trace);
        let str;
        let trace;
        if (msg.data.type == "jserror") {
            str = msg.data.data;
            trace = msg.data.trace;
        } else {
            str = "";
            for (let value of Object.values(msg.data.data)) {
                if (typeof value == "object") {
                    str += JSON.stringify(value);
                } else {
                    str += value;
                }
                str += " ";
            }
            str = str.slice(0, str.length - 1);
            trace = msg.data.trace[1];
        }
        let traceFile = originalURLS[blobURLS.indexOf(trace.file)];
        // console.log(originalURLS, blobURLS, trace.file, traceFile);
        let traceStr = `${trace.methodName}@${traceFile}:${trace.lineNumber - (traceFile.endsWith(".html") ? 30 : 0)}:${trace.column}`;
        let d = new Date();
        let dateStr = `${d.getHours().toString().padStart("2", "0")}:${d.getMinutes().toString().padStart("2", "0")}:${d.getSeconds().toString().padStart("2", "0")}.${d.getMilliseconds().toString().padStart("3", "0")}`;
        logs.push({ time: dateStr, type: msg.data.type == "jserror" ? "error" : msg.data.type, data: str, trace: traceStr });
        // document.querySelector("#logs-amount").dataset.amount = logs.length;
        document.querySelector("#logs-amount").innerText = logs.length;
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
        await sleep(50);
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
        if (document.cookie) {
            let cookieData = JSON.parse(decodeURIComponent(document.cookie.split("=").at(-1).split(";")[0]));
            if (cookieData.name == siteName) {
                window.sitePass = cookieData.pass;
            }
            console.log(document.cookie);
            document.cookie += ";expires=Thu, 01 Jan 1970 00:00:01 GMT";
            console.log("parsed password", cookieData);
        }
        await Swal.fire({
            title: `Enter the password of the site: ${siteName}`,
            html: '<input type="password" id="password" class="swal2-input" style="width: 80%;">',
            confirmButtonText: "Edit",
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            didOpen: () => {
                const popup = Swal.getPopup();
                passwordInput = popup.querySelector("#password");
                passwordInput.onkeydown = (event) => {
                    if (event.key === "Enter") {
                        Swal.clickConfirm();
                    }
                };
                passwordInput.focus();
                if (window.sitePass) {
                    console.log("prefilling password");
                    passwordInput.value = sitePass;
                    passwordInput.readonly = true;
                    Swal.clickConfirm();
                }
            },
            preConfirm: async () => {
                let pass = window.sitePass || document.querySelector("#password").value;
                window.sitePass = pass;
                console.log("okay");
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
                    // document.querySelector(".deleteButton").style.display = "flex"
                    // document.querySelector(".deleteButton").addEventListener("click", handleDelete);
                    document.querySelector(".viewButton").style.display = "flex";
                    document.querySelector(".viewButton").addEventListener("click", viewSite);

                    document.addEventListener("keydown", (e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                            // Prevent the Save dialog to open
                            e.preventDefault();
                            // Place your code here
                            console.log("CTRL + S");
                            document.querySelector(".deployButton").click();
                        }
                    });

                    history.replaceState({}, "", location.origin + location.pathname + `?edit=${siteName}`);
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
    document.querySelector("#delete-file").addEventListener("click", deleteFile);
    document.querySelector("#rename-file").addEventListener("click", renameFile);
    document.querySelector(".deployButton").addEventListener("click", handleDeploy);
    document.querySelector("#prettify-file").addEventListener("click", prettify);
    createHierarchy(files);
    loadFile(currentFile);
    createSite();
    handleSliders();
    document.documentElement.style.setProperty("--hierarchy-width", getComputedStyle(document.querySelector("#files")).width);
}

function createSite() {
    if (previewPage && files[previewPage]) {
        loadPage(previewPage);
    } else {
        loadPage("index.html");
    }
}

function createBlobURL(blob, filename) {
    let url = URL.createObjectURL(blob);
    blobURLS.push(url);
    originalURLS.push(filename ?? "unknown");
    // console.log("creating blob", blob)
    return url;
}

function revokeOldURLS() {
    console.log("revoking old blobs");
    while (blobURLS[0]) {
        // console.log("revoking url", blobURLS[0])
        blobURLS.shift();
        URL.revokeObjectURL(blobURLS[0]);
    }
    originalURLS = [];
    // console.log("done")
}

function loadPage(path, setPreview = false) {
    revokeOldURLS();
    logs = [];
    if (setPreview) {
        previewPage = path;
        console.log(path, previewPage);
    }
    // document.querySelector("#logs-amount").dataset.amount = "0";
    document.querySelector("#logs-amount").innerText = "0";
    let file = files[path];
    let dom = new DOMParser().parseFromString(file, "text/html");
    let els = dom.querySelectorAll("link, a, script");
    for (let el of els) {
        let attr = el.tagName == "SCRIPT" ? "src" : "href";
        if (el[attr] && !el.getAttribute(attr).startsWith("https://")) {
            if (el.getAttribute(attr).startsWith("/")) {
                el.setAttribute(attr, el.getAttribute(attr).slice(1));
            }
            if (el.tagName == "A") {
                let targetAttrStr = btoa(`top.postMessage({l: \`${el.getAttribute(attr)}\`}, "*")`);
                el[attr] = `javascript:eval(atob('${targetAttrStr}'))`;
            } else {
                let fileBlob;
                if (el.tagName == "SCRIPT") {
                    let string = files[el.getAttribute(attr)].replace(/fetch\(+['|"].+?(?=['|"]).[\)|,]/g, function (str) {
                        let start = str.indexOf("fetch(") + 7;
                        let end = str.slice(start).search(/['|"]/) + start;
                        let path = str.slice(start, end);
                        if (path.startsWith("/")) {
                            path = path.slice(1);
                            start += 1;
                        }
                        if (!path.endsWith(".json") || !files[path]) {
                            return str;
                        }
                        let url = createBlobURL(new Blob([files[path]], { type: "application/json" }));
                        return `fetch("${url}"${str.endsWith(")") ? ")" : ""}`;
                    });
                    fileBlob = new Blob([string], { type: "application/javascript" });
                } else {
                    fileBlob = new Blob([files[el.getAttribute(attr)]], { type: el.getAttribute(attr).endsWith(".css") ? "text/css" : el.getAttribute(attr).endsWith(".js") ? "application/javascript" : "text/html" });
                }
                if (el.tagName == "SCRIPT") {
                    el[attr] = createBlobURL(fileBlob, el.getAttribute(attr));
                } else {
                    el[attr] = createBlobURL(fileBlob);
                }
            }
        }
    }
    let consoleOverrideScript = `
    // import * as stackTraceParser from 'https://cdn.jsdelivr.net/npm/stacktrace-parser@0.1.11/+esm';
    // stack trace parser
    var e="<unknown>";function n(n){return n.split("\\n").reduce((function(n,o){var m=function(n){var u=l.exec(n);if(!u)return null;var t=u[2]&&0===u[2].indexOf("native"),a=u[2]&&0===u[2].indexOf("eval"),i=r.exec(u[2]);a&&null!=i&&(u[2]=i[1],u[3]=i[2],u[4]=i[3]);return{file:t?null:u[2],methodName:u[1]||e,arguments:t?[u[2]]:[],lineNumber:u[3]?+u[3]:null,column:u[4]?+u[4]:null}}(o)||function(n){var l=u.exec(n);if(!l)return null;return{file:l[2],methodName:l[1]||e,arguments:[],lineNumber:+l[3],column:l[4]?+l[4]:null}}(o)||function(n){var l=t.exec(n);if(!l)return null;var r=l[3]&&l[3].indexOf(" > eval")>-1,u=a.exec(l[3]);r&&null!=u&&(l[3]=u[1],l[4]=u[2],l[5]=null);return{file:l[3],methodName:l[1]||e,arguments:l[2]?l[2].split(","):[],lineNumber:l[4]?+l[4]:null,column:l[5]?+l[5]:null}}(o)||function(n){var l=c.exec(n);if(!l)return null;return{file:l[2],methodName:l[1]||e,arguments:[],lineNumber:+l[3],column:l[4]?+l[4]:null}}(o)||function(n){var l=i.exec(n);if(!l)return null;return{file:l[3],methodName:l[1]||e,arguments:[],lineNumber:+l[4],column:l[5]?+l[5]:null}}(o);return m&&n.push(m),n}),[])}var l=/^\\s*at (.*?) ?\\(((?:file|https?|blob|chrome-extension|native|eval|webpack|rsc|<anonymous>|\\/|[a-z]:\\\\|\\\\\\\\).*?)(?::(\\d+))?(?::(\\d+))?\\)?\\s*$/i,r=/\\((\\S*)(?::(\\d+))(?::(\\d+))\\)/;var u=/^\\s*at (?:((?:\\[object object\\])?.+) )?\\(?((?:file|ms-appx|https?|webpack|rsc|blob):.*?):(\\d+)(?::(\\d+))?\\)?\\s*$/i;var t=/^\\s*(.*?)(?:\\((.*?)\\))?(?:^|@)((?:file|https?|blob|chrome|webpack|rsc|resource|\\[native).*?|[^@]*bundle)(?::(\\d+))?(?::(\\d+))?\\s*$/i,a=/(\\S+) line (\\d+)(?: > eval line \\d+)* > eval/i;var i=/^\\s*(?:([^@]*)(?:\\((.*?)\\))?@)?(\\S.*?):(\\d+)(?::(\\d+))?\\s*$/i;var c=/^\\s*at (?:((?:\\[object object\\])?[^\\\\/]+(?: \\[as \\S+\\])?) )?\\(?(.*?):(\\d+)(?::(\\d+))?\\)?\\s*$/i;window.parseStackTrace=n;

    var getStackTrace = function() {
        var obj = {};
        Error.captureStackTrace(obj, getStackTrace);
        // return stackTraceParser.parse(obj.stack);
        return parseStackTrace(obj.stack);
        // return Error().stack.toString()
    };
    
    // override console
    if (window.console && console) {
    for (let c in console) {
        if (typeof console[c] === 'function') {
            const cx = console[c]
            console[c] = function () {
                window.top.postMessage({"action": "console", "type": c.toString(), "data": JSON.parse(JSON.stringify(arguments)), "trace": getStackTrace()}, "*")
                cx.apply(this, [...arguments])
                // cx.apply(this, [getStackTrace()])
            }
        }
    }
    
    // global error handler
    window.onerror = function (message, file, line, col, error) {
        // alert("Error occurred: " + error.message);
        window.top.postMessage({"action": "console", "type": "jserror", "data": message, "trace": {methodName: "<unknown>", file: file, lineNumber: line, column: col}}, "*")
        return false;
    };
}`;
    let s = document.createElement("script");
    s.innerHTML = consoleOverrideScript;
    // s.type = "module";
    var node = dom.doctype;
    var doctypeString = dom.doctype ? "<!DOCTYPE " + node.name + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : "") + (!node.publicId && node.systemId ? " SYSTEM" : "") + (node.systemId ? ' "' + node.systemId + '"' : "") + ">" : "";
    dom.body.insertBefore(s, dom.body.firstChild);
    document.querySelector("#preview").src = createBlobURL(new Blob([doctypeString + dom.documentElement.outerHTML], { type: "text/html" }), path);
}

function saveFile() {
    files[currentFile] = view.state.doc.toString();
}

function loadFile(path, clearUndoHistory = true) {
    currentFile = path;
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: files[path] },
    });

    if (clearUndoHistory) {
        cm6.resetUndoRedo(view);
    }

    document.querySelector("#current-file").value = currentFile;

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
        case path.endsWith(".json"):
            targetLang = "json";
            break;
        default:
            return;
    }
    view.dispatch({
        effects: cm6.makeLanguageConf(targetLang),
    });
}

function getProp(el, prop) {
    return parseFloat(getComputedStyle(el)[prop].replace("px", ""));
}

function handleSliders() {
    let block = document.querySelector("#editor");
    let block2 = document.querySelector("#files");
    let preview = document.querySelector("#preview-manage");
    let slider = document.querySelector(".slider");
    let slider2 = document.querySelector(".slider2");

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
}

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
            while (path.startsWith("/")) {
                path = path.slice(1);
            }
            if (!path) {
                Swal.showValidationMessage("A file name is required");
            }
            if (path.endsWith(".html") || path.endsWith(".css") || path.endsWith(".js") || path.endsWith(".json")) {
                if (files[path]) {
                    Swal.showValidationMessage("A file with that name already exists");
                } else {
                    files[path] = "";
                    saveFile();
                    currentFile = path;
                    loadFile(currentFile);
                    createHierarchy(files);
                }
            } else {
                Swal.showValidationMessage("Only .html, .css, .js, and .json file formats supported");
            }
        },
    });
}

const escapeHtml = (unsafe) => {
    return unsafe.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
};

async function handleDeploy(e) {
    e.preventDefault();
    if (document.querySelector(".deployButton").dataset.disabled == "true") {
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
        await sleep(100);
        document.querySelector(".deployButton").dataset.disabled = false;
        document.querySelector("#deploy-text").innerText = "Save Changes";
        if (response.ok) {
            settings.unsavedChanges = false;
            toast("Site updated successfully");
            if (siteName != newName) {
                siteName = newName;
                Swal.fire({
                    icon: "success",
                    html: `Your site has been updated! You can find the updated version at <a target="_blank" href="https://${escapeHtml(newName)}.${location.hostname}">https://${escapeHtml(newName)}.${location.hostname}`,
                });
            }
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

async function handleDelete(e) {
    // e.preventDefault();
    let result = await Swal.fire({
        title: "Confirm site deletion",
        html: `Are you sure you want to delete <b>${escapeHtml(siteName)}</b>? <span style="color: red;">Warning: THIS ACTION IS IRREVERSIBLE</span>`,
        showCancelButton: true,
        denyButtonText: "Continue",
        showDenyButton: true,
        showConfirmButton: false,
        icon: "question",
    });
    if (result.isDenied) {
        let result2 = await Swal.fire({
            title: "Confirm site deletion final warning",
            html: `Are you absolutely sure you want the project <b>${escapeHtml(siteName)}</b> to be lost forever?`,
            showCancelButton: true,
            denyButtonText: "Continue",
            showConfirmButton: false,
            showDenyButton: true,
            icon: "question",
            showLoaderOnDeny: true,
            preDeny: async () => {
                let response = await fetch("/app/edit", {
                    method: "POST",
                    body: JSON.stringify({
                        action: "delete",
                        siteName: siteName,
                        sitePass: sitePass,
                    }),
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                if (response.ok) {
                    location.href = "/?deleted";
                    await sleep(999999);
                } else {
                    Swal.fire({
                        title: "Error",
                        text: "There was an error while deleting your site: " + (await response.text()),
                        icon: "error",
                    });
                }
            },
        });
    }
}

async function deleteFile() {
    let result = await Swal.fire({
        title: "Confirm file deletion",
        html: `Are you sure you want to delete the file <b>${escapeHtml(currentFile)}</b>? This action is irreversible!`,
        showCancelButton: true,
        denyButtonText: "Delete",
        showConfirmButton: false,
        showDenyButton: true,
        icon: "question",
    });

    if (result.isDenied) {
        delete files[currentFile];
        if (previewPage == currentFile) {
            previewPage = Object.keys(files)[0];
        }
        currentFile = Object.keys(files)[0];
        loadFile(currentFile);
        createHierarchy(files);
        createSite();
        toast("File deleted");
    }
}

async function renameFile() {
    await Swal.fire({
        title: "Enter the new name of the file",
        input: "text",
        inputValue: currentFile,
        confirmButtonText: "Rename",
        preConfirm: (path) => {
            while (path.startsWith("/")) {
                path = path.slice(1);
            }
            if (!path) {
                Swal.showValidationMessage("A file name is required");
            }
            if (path.endsWith(".html") || path.endsWith(".css") || path.endsWith(".js") || path.endsWith(".json")) {
                if (files[path]) {
                    Swal.showValidationMessage("A file with that name already exists");
                } else {
                    files[path] = files[currentFile];
                    delete files[currentFile];
                    currentFile = path;
                    createHierarchy(files);
                    loadFile(currentFile);
                    createSite();
                    toast("File renamed");
                }
            } else {
                Swal.showValidationMessage("Only .html, .css, .js, and .json file formats supported");
            }
        },
    });
}

function viewSite(e) {
    e.preventDefault();
    window.open(`https://${siteName}.${location.hostname}`);
}

function toast(msg) {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "bottom",
        position: "right",
    }).showToast();
}

async function prettify() {
    let output;
    let path = currentFile;
    switch (true) {
        case path.endsWith(".html"):
            output = html_beautify(files[path]);
            break;
        case path.endsWith(".js"):
            output = js_beautify(files[path]);
            break;
        case path.endsWith(".css"):
            output = css_beautify(files[path]);
            break;
        case path.endsWith(".json"):
            try {
                output = JSON.stringify(JSON.parse(files[path]), null, 4);
            } catch (e) {
                await Swal.fire({
                    icon: "error",
                    title: "Error prettifying",
                    text: `There was an error while prettifying the JSON — ${e}`,
                });
                output = files[path];
            }
            break;
        default:
            return;
    }
    files[path] = output;
    loadFile(currentFile, false);
    toast("Prettification complete!");
}

function openSettings() {
    Swal.fire({
        title: "Manage",
        html: `<h3>Preview</h3><span>Preview update delay in miliseconds</span><br>
        <input type="range" min="0" max="2000" value=${updatePreviewWaitTime} oninput="updatePreviewWaitTime = this.value;this.nextElementSibling.nextElementSibling.innerText = 'Current: ' + updatePreviewWaitTime + ' milliseconds'"><br><span>Current: ${updatePreviewWaitTime} milliseconds</span>
        <br><h3>Manage Site</h3><a class="deleteButton" onclick="handleDelete()">Delete Site</a><hr></div>
        `,
        confirmButtonText: "Done",
    });
}

// <br><button class="logsButton" onclick="viewLogs()">View Console Logs</button>

function viewLogs() {
    Swal.fire({
        title: "Console Logs",
        // html: `<textarea id="logs" readonly style="width: 99%; height: 300px; resize: none;">`,
        html: `<div id="logs" style="width: 99%; height: 300px; text-align: left; font-family: monospace; font-size: 16px;"></div>`,
        width: 950,
        confirmButtonText: "Done",
        didOpen: () => {
            let logsEl = document.querySelector("#logs");
            let allowed = ["log", "warn", "info", "error"];
            for (let log of logs) {
                if (allowed.includes(log.type)) {
                    // logsEl.value += `${log.time} — ${log.trace} — ${log.type} — ${d}\n`;
                    let newEl = document.createElement("div");
                    let typeStr = "";
                    if (log.type == "error") {
                        typeStr = "❌";
                    } else if (log.type == "warn") {
                        typeStr = "⚠️";
                    } else {
                        typeStr = "ℹ️";
                    }
                    newEl.innerText += `${typeStr} [${log.time}] ${log.trace} — ${log.data}`;
                    if (log.type == "warn") {
                        newEl.style.backgroundColor = "#fffbd6";
                    } else if (log.type == "error") {
                        newEl.style.backgroundColor = "#fcebeb";
                    }
                    logsEl.appendChild(newEl);
                }
            }
        },
    });
}
