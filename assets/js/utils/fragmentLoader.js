const FRAGMENTS = [
    { id: "nav-header", path: "fragments/nav-header.html", target: "body", position: "afterbegin" },
    { id: "offcanvas-menu", path: "fragments/offcanvas-menu.html", target: "body", position: "beforeend" },
    { id: "auth-modal", path: "fragments/auth-modal.html", target: "body", position: "beforeend" },
    { id: "confirm-modal", path: "fragments/confirm-modal.html", target: "body", position: "beforeend" },
    { id: "reset-modal", path: "fragments/reset-modal.html", target: "body", position: "beforeend" },
    { id: "logout-modal", path: "fragments/logout-modal.html", target: "body", position: "beforeend" },
    { id: "canvas-area", path: "fragments/canvas-area.html", target: "body", position: "beforeend" },
    { id: "trade-modal", path: "fragments/trade-modal.html", target: "body", position: "beforeend" },
];

async function loadFragment(fragment) {
    try {
        const response = await fetch(fragment.path);
        if (!response.ok) throw new Error(`Failed to load ${fragment.path}`);
        const html = await response.text();
        const target = document.querySelector(fragment.target);
        if (!target) throw new Error(`Target ${fragment.target} not found`);
        target.insertAdjacentHTML(fragment.position, html);
    } catch (err) {
        console.error(`Fragment load error [${fragment.id}]:`, err);
    }
}

export async function loadAllFragments() {
    await Promise.all(FRAGMENTS.map(loadFragment));
}

export async function loadFragmentInto(path, containerSelector) {
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        const html = await response.text();
        const container = document.querySelector(containerSelector);
        if (container) container.innerHTML = html;
    } catch (err) {
        console.error(`Fragment load error [${path}]:`, err);
    }
}
