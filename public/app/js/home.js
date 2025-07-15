let params = new URLSearchParams(location.search);
if (params.has("deleted")) {
    window.addEventListener("load", function () {
        Swal.fire({
            title: "Deleted",
            text: "Your site has been deleted",
            icon: "success",
        });
    });
    history.replaceState({}, "", location.origin + location.pathname);
}
