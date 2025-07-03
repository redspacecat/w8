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
})`
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

window.addEventListener("message", function(msg, origin) {
    console.log(msg, origin)
    if (msg.data.loadPage) {
        loadPage(msg.data.loadPage)
    }
})

function setup() {
    createHierarchy(files);
    loadFile(currentFile);
    createSite();
    document.documentElement.style.setProperty("--hierarchy-width", getComputedStyle(document.querySelector("#files")).width);
}

function createSite() {
    loadPage("index.html")
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
               el[attr] = `javascript:window.top.postMessage({loadPage: \`${el.getAttribute(attr)}\`}, "*")`
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

slider.onmousedown = function dragMouseDown(e) {
    let dragX = e.clientX;
    preview.style.pointerEvents = "none";
    document.onmousemove = function onMouseMove(e) {
        if (parseFloat(getComputedStyle(slider).left.replace("px", "")) - parseFloat(getComputedStyle(slider2).left.replace("px", "")) > 100) {
            block.style.width = parseFloat(getComputedStyle(block).width.replace("px", "")) + e.clientX - dragX + "px";
            slider.style.left = parseFloat(getComputedStyle(slider).left.replace("px", "")) + e.clientX - dragX + "px";
            dragX = e.clientX;
        } else if (e.clientX - dragX > 0) {
            block.style.width = parseFloat(getComputedStyle(block).width.replace("px", "")) + e.clientX - dragX + "px";
            slider.style.left = parseFloat(getComputedStyle(slider).left.replace("px", "")) + e.clientX - dragX + "px";
            dragX = e.clientX;
        }
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
        if (parseFloat(getComputedStyle(slider).left.replace("px", "")) - parseFloat(getComputedStyle(slider2).left.replace("px", "")) > 100) {
            block2.style.width = parseFloat(getComputedStyle(block2).width.replace("px", "")) + e.clientX - dragX + "px";
            document.documentElement.style.setProperty("--hierarchy-width", block2.style.width);
            block.style.width = parseFloat(getComputedStyle(block).width.replace("px", "")) - (e.clientX - dragX) + "px";
            slider2.style.left = parseFloat(getComputedStyle(slider2).left.replace("px", "")) + e.clientX - dragX + "px";
            dragX = e.clientX;
        } else if (e.clientX - dragX < 0) {
            block2.style.width = parseFloat(getComputedStyle(block2).width.replace("px", "")) + e.clientX - dragX + "px";
            document.documentElement.style.setProperty("--hierarchy-width", block2.style.width);
            block.style.width = parseFloat(getComputedStyle(block).width.replace("px", "")) - (e.clientX - dragX) + "px";
            slider2.style.left = parseFloat(getComputedStyle(slider2).left.replace("px", "")) + e.clientX - dragX + "px";
            dragX = e.clientX;
        }
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
                path = path.slice(1)
            }
            if (!path) {
                Swal.showValidationMessage("A file name is required")
            }
            if (path.endsWith(".html") || path.endsWith(".css") || path.endsWith(".js")) {
                files[path] = ""
                saveFile()
                currentFile = path
                loadFile(currentFile)
                createHierarchy(files)
            } else {
                Swal.showValidationMessage("Only .html, .css, and .js file formats supported");
            }
        },
    });
}
