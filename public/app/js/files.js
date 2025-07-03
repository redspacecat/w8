var hierarchy = document.getElementById("hierarchy");
hierarchy.addEventListener("click", function (event) {
    var elem = event.target;
    if (elem.tagName.toLowerCase() == "span" && elem !== event.currentTarget) {
        var type = elem.classList.contains("folder") ? "folder" : "file";
        if (type == "file") {
            // alert("File accessed");
            let els = [];
            let a = elem;
            while (a) {
                if (a.parentElement.id == "files") {
                    break;
                }
                if (a.classList.contains("foldercontainer")) {
                    els.unshift(a);
                }
                a = a.parentElement;
            }
            let path = "";
            for (let el of els) {
                path += el.children[0].innerText + "/";
            }
            path += elem.innerText;
            // console.log(els)
            console.log(path);
            saveFile();
            loadFile(path);
            if (path.endsWith(".html")) {
                loadPage(path)
            }
        }
        if (type == "folder") {
            var isexpanded = elem.dataset.isexpanded == "true";
            if (isexpanded) {
                elem.classList.remove("fa-folder-o");
                elem.classList.add("fa-folder");
            } else {
                elem.classList.remove("fa-folder");
                elem.classList.add("fa-folder-o");
            }
            elem.dataset.isexpanded = !isexpanded;

            var toggleelems = [].slice.call(elem.parentElement.children);
            var classnames = "file,foldercontainer,noitems".split(",");

            toggleelems.forEach(function (element) {
                if (
                    classnames.some(function (val) {
                        return element.classList.contains(val);
                    })
                )
                    element.style.display = isexpanded ? "none" : "block";
            });
        }
    }
});

function htmlToNode(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const nNodes = template.content.childNodes.length;
    if (nNodes !== 1) {
        throw new Error(`html parameter must represent a single node; got ${nNodes}. `);
    }
    return template.content.firstChild;
}

/**
 *
 *  Base64 encode / decode
 *  http://www.webtoolkit.info/
 *
 **/
var Base64 = {
    // private property
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode: function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        input = Base64._utf8_encode(input);

        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output + this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) + this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
        }
        return output;
    },

    // public method for decoding
    decode: function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {
            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }

        output = Base64._utf8_decode(output);

        return output;
    },

    // private method for UTF-8 encoding
    _utf8_encode: function (string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if (c > 127 && c < 2048) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode: function (utftext) {
        var string = "";
        var i = 0;
        var c = (c1 = c2 = 0);

        while (i < utftext.length) {
            c = utftext.charCodeAt(i);

            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            } else if (c > 191 && c < 224) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            } else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    },
};

function createHierarchy(files) {
    let paths = Object.keys(files);
    var obj = {};
    paths.forEach(function (path) {
        path.split("/").reduce(function (r, e) {
            return r[e] || (r[e] = {});
        }, obj);
    });

    let structure = obj;
    let outputEl = document.getElementById("hierarchy");
    let output = { data: "" };
    console.log(structure);
    generateHTML(output, structure);
    outputEl.innerHTML = output.data;
    outputEl.querySelectorAll("span[data-shoulddecode]").forEach(function (el) {
        el.innerText = Base64.decode(el.innerText);
        el.removeAttribute("data-shoulddecode");
    });
    // for (let el of elsToDecode) {
    //     el.innerText = Base64.decode(el.innerText)
    // }
    //     <div class="foldercontainer">
    //     <span class="folder fa-folder" data-isexpanded="true">Folder 1-1</span>
    //     <span class="file fa-file-excel-o">File 1-11</span>
    //     <span class="file fa-file-code-o">File 1-12</span>
    //     <span class="file fa-file-pdf-o">File 1-13</span>
    // </div>
}

function generateHTML(parent, structure) {
    console.log(parent, structure, Object.keys(structure));
    Object.keys(structure).forEach(function (a) {
        console.log(structure[a]);
        if (Object.keys(structure[a]).length == 0) {
            console.log("file...");
            // parent.appendChild(htmlToNode(`<span class="file fa-file-code-o">${Object.keys(structure)[0]}</span>`));
            parent.data += `<span class="file fa-file-code-o" data-shoulddecode>${Base64.encode(a)}</span>`;
        } else {
            console.log("folder...");
            parent.data += `<div class="foldercontainer">`;
            parent.data += `<span class="folder fa-folder-o" data-isexpanded="true" data-shoulddecode>${Base64.encode(a)}</span>`;
            generateHTML(parent, structure[a]);
            // console.log("creating", structure[a])
            parent.data += `</div>`;
        }
    });
}
