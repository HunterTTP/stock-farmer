const installBtn = document.getElementById("installBtn");
let deferredPrompt = null;

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

function setInstallButton(enabled) {
  if (!installBtn) return;
  installBtn.disabled = !enabled;
  installBtn.classList.toggle("opacity-50", !enabled);
  installBtn.classList.toggle("cursor-not-allowed", !enabled);
}

const hideInstallIfStandalone = () => {
  if (!installBtn) return;
  if (isStandalone()) {
    installBtn.classList.add("hidden");
    setInstallButton(false);
  } else {
    installBtn.classList.remove("hidden");
  }
};

// Start disabled until we have a user-initiated path to prompt.
setInstallButton(false);
hideInstallIfStandalone();

window.addEventListener("beforeinstallprompt", (event) => {
  // Gate the browser prompt until the user taps the install button.
  event.preventDefault();
  deferredPrompt = event;
  setInstallButton(true);
  hideInstallIfStandalone();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  setInstallButton(false);
  hideInstallIfStandalone();
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (isStandalone()) return;
    if (isIOS()) {
      // iOS does not support the install prompt; show guidance on demand.
      alert("To install on iOS, tap the Share button and choose \"Add to Home Screen.\"");
      return;
    }
    if (!deferredPrompt) return;
    try {
      setInstallButton(false);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome !== "accepted") {
        setInstallButton(true);
      }
    } finally {
      deferredPrompt = null;
    }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    hideInstallIfStandalone();
    if (installBtn && isIOS() && !isStandalone()) {
      // iOS requires manual instructions; enable button so users can request them.
      setInstallButton(true);
      installBtn.classList.remove("hidden");
    }
    navigator.serviceWorker
      .register("sw.js", { scope: "./" })
      .catch((err) => console.error("[pwa] sw register failed", err));
  });
}
