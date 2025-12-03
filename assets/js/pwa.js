const installBtn = document.getElementById("installBtn");
let deferredPrompt = null;

function setInstallButton(enabled) {
  if (!installBtn) return;
  installBtn.disabled = !enabled;
  installBtn.classList.toggle("opacity-50", !enabled);
  installBtn.classList.toggle("cursor-not-allowed", !enabled);
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  setInstallButton(true);
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  setInstallButton(false);
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    setInstallButton(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome !== "accepted") {
      setInstallButton(true);
    }
    deferredPrompt = null;
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js", { scope: "./" })
      .catch((err) => console.error("[pwa] sw register failed", err));
  });
}
