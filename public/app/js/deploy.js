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

// Function to redirect to home
function home() {
    document.body.innerHTML = "<h3 class='text-2xl font-semibold text-gray-700'>Redirecting...</h3>";
    window.location.href = "/";
}

/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 * binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
function humanFileSize(bytes, si = false, dp = 1) {
    if (bytes > 1000000) {
        // one megabyte
        alertify
            .alert("There is a site size limit of one megabyte for now, this may be increased in the future.", function () {
                location.href = "/";
            })
            .set({ title: "Your site is too large!" })
            .set({ movable: false });
        document.querySelector("#deployButton").hidden = true;
    } else {
        document.querySelector("#deployButton").hidden = false;
    }
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + " B";
    }

    const units = si ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"] : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + " " + units[u];
}

// Function to update the character count display
function updateCharCount() {
    const nameInput = document.getElementById("name");
    const charCountSpan = document.getElementById("charCount");
    const currentLength = nameInput.value.length;
    const maxLength = nameInput.maxLength;
    charCountSpan.textContent = `${currentLength}/${maxLength}`;
}

var replacements = { "\\\\": "\\", "\\n": "\n", '\\"': '"' };

function slashUnescape(contents) {
    return contents.replace(/\\(\\|n|")/g, function (replace) {
        return replacements[replace];
    });
}

// Main async function to load data
/*(async function () {
            if (!window.location.hash) {
                home();
            } else {
                try {
                    // Fetch data from the blob URL
                    window.data = await (await fetch(`blob:${window.location.origin}/${window.location.hash.slice(1)}`)).json();
                } catch (error) {
                    // Log error and redirect if fetch fails
                    console.error("Failed to fetch data:", error);
                    home();
                }
                // Populate input field and size display
                document.querySelector("#name").value = data.name;
                document.querySelector("#size").innerText = humanFileSize(new File([slashUnescape(JSON.stringify(data.files))], "text/plain").size, true, 2);
                updateCharCount(); // Update count on initial load
            }
        })();*/

// Removed the event listener for 'addPasswordButton' as it's no longer needed for toggling

// Add event listener for the deploy button
document.getElementById("deployButton").addEventListener("click", (event) => {
    const nameInput = document.getElementById("name");
    const passwordInput = document.getElementById("password");

    // Check if the input is valid before proceeding with deployment
    if (!nameInput.checkValidity()) {
        nameInput.reportValidity(); // Show browser's validation message
        return; // Stop the function if validation fails
    }
    if (!passwordInput.checkValidity()) {
        passwordInput.reportValidity(); // Show browser's validation message
        return; // Stop the function if validation fails
    }

    const deployButton = event.currentTarget;
    const loader = document.getElementById("loader");

    // Hide the button and show the loader
    deployButton.style.display = "none"; // Hide the button
    loader.classList.add("active"); // Show the loader

    // Get the password value, or an empty string if not provided
    const password = passwordInput.value;

    // Placeholder for actual deployment logic
    console.log("Deploy button clicked! Initiating deployment for:", document.querySelector("#name").value);
    console.log("Optional password:", password);

    (async function () {
        let response = await fetch("/app/deploy", {
            method: "POST",
            body: JSON.stringify({ name: document.querySelector("#name").value, files: files, password: password }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        loader.classList.remove("active"); // Hide the loader
        deployButton.style.display = "block"; // Show the button (or flex/inline-block if needed)
        if (response.ok) {
            console.log("Deployment process completed.");
            let n = document.querySelector("#name").value;
            document.cookie = `sitepass=${encodeURIComponent(JSON.stringify({ name: n, pass: password }))};path=/app`;
            location.href = "editor?edit=" + n;
            // alertify.alert(`Your site has been deployed successfully! You can find it at <a href='/s/${n}' style='color: blue;'>${window.location.origin}/s/${n}</a> or edit it <a href='/app/editor/?edit=${n}' style='color: blue;'>here</a>`).set({ title: "Deployment completed" }).set({ movable: false });
        } else {
            console.log("Error deploying");
            let result = await response.text();
            alertify.alert(`There was an error while deploying your site — Status code: ${response.status}, Info: ${result}`).set({ title: "Deployment failed" }).set({ movable: false });
        }
        //alert(text)
    })();
});
