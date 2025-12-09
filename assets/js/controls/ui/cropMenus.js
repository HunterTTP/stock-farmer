import { getCropGrowTimeMs } from "../../utils/helpers.js";

function formatDurationMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}hr`);
  if (hrs > 0 || mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function formatGrowTime(minutes) {
  if (!Number.isFinite(minutes)) return "";
  if (minutes > 0 && minutes < 1) {
    const secs = Math.round(minutes * 60);
    return `${secs}sec`;
  }
  if (minutes === 60) return "1hr";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins === 0) return `${hrs}hr`;
  if (hrs > 0) return `${hrs}hr ${mins}m`;
  return `${minutes}m`;
}

function formatHarvestText(crop, plantedAt, nowMs) {
  if (!crop || !Number.isFinite(plantedAt)) return null;
  const growMs =
    Number.isFinite(crop.lastPlantedGrowMs) && crop.lastPlantedGrowMs > 0
      ? crop.lastPlantedGrowMs
      : getCropGrowTimeMs(crop);
  if (!growMs || growMs <= 0) return "Ready";
  const remainingMs = Math.max(0, growMs - (nowMs - plantedAt));
  if (remainingMs <= 0) return "Ready";
  return formatDurationMs(remainingMs);
}

function getCropStatus(crop, nowMs) {
  if (!crop) return null;
  if (!crop.placed || crop.placed <= 0) return null;
  const plantedAt = Number.isFinite(crop.lastPlantedAt) ? crop.lastPlantedAt : null;
  if (!plantedAt || plantedAt <= 0) return null;
  const harvestText = formatHarvestText(crop, plantedAt, nowMs);
  if (!harvestText) return null;
  return { count: crop.placed, harvestText };
}

const cropThumbSrc = (cropId) => (cropId ? `images/crops/${cropId}/${cropId}-phase-4.png` : "images/farmland.jpg");

export function createCropMenus({ dom, state, crops, formatCurrency, onMoneyChanged, openConfirmModal, closeAllMenus, saveState }) {
  function ensurePlantDefaults() {
    if (!state.selectedCropKey) {
      const fallback = state.previousCropKey && crops[state.previousCropKey] && crops[state.previousCropKey].unlocked ? crops[state.previousCropKey] : null;
      const firstUnlocked = fallback || Object.values(crops).find((c) => c && c.unlocked);
      if (firstUnlocked) {
        state.selectedCropKey = firstUnlocked.id;
        state.previousCropKey = firstUnlocked.id;
      }
    }
  }

  function renderPlantCropMenu(nowMs) {
    if (!dom.plantCropMenu) return;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    dom.plantCropMenu.innerHTML = "";
    let chainLocked = false;
    Object.values(crops).forEach((crop) => {
      const canAffordUnlock = !crop.unlocked && typeof crop.unlockCost === "number" && crop.unlockCost > 0 && state.totalMoney >= crop.unlockCost;
      const gatedLocked = !crop.unlocked && chainLocked;
      const item = document.createElement("button");
      item.type = "button";
      item.className = "w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (!crop.unlocked && !canAffordUnlock) item.classList.add("opacity-50", "cursor-not-allowed");
      if (gatedLocked) item.classList.add("opacity-50", "cursor-not-allowed");
      if (crop.id === state.selectedCropKey) item.classList.add("border-accent", "bg-neutral-900/70");

      const img = document.createElement("img");
      img.src = cropThumbSrc(crop.id);
      img.alt = crop.name;
      img.className = "w-5 h-5 rounded-sm object-cover border border-neutral-800";
      item.appendChild(img);

      const textWrap = document.createElement("div");
      textWrap.className = "flex-1 min-w-0";
      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-white truncate";
      title.textContent = crop.name;
      const meta = document.createElement("div");
      meta.className = "text-[11px] text-neutral-400 truncate";
      meta.textContent = `Sells for ${formatCurrency(crop.baseValue)} - ${formatGrowTime(crop.growMinutes)}`;
      textWrap.appendChild(title);
      textWrap.appendChild(meta);
      const status = getCropStatus(crop, now);
      if (status) {
        const statusLine = document.createElement("div");
        statusLine.className = "text-[11px] text-accent-soft truncate";
        statusLine.textContent = `Planted: ${status.count} | ${status.harvestText}`;
        textWrap.appendChild(statusLine);
      }
      if (!crop.unlocked && crop.unlockCost > 0) {
        const lockHint = document.createElement("div");
        lockHint.className = "text-[11px] font-semibold text-amber-300";
        lockHint.textContent = `Unlock for ${formatCurrency(crop.unlockCost)}`;
        textWrap.appendChild(lockHint);
      }
      item.appendChild(textWrap);

      item.addEventListener("click", () => {
        if (gatedLocked) return;
        if (!crop.unlocked) {
          if (crop.unlockCost > 0 && state.totalMoney >= crop.unlockCost) {
            openConfirmModal(
              `Unlock ${crop.name} for ${formatCurrency(crop.unlockCost)}?`,
              () => {
                state.totalMoney -= crop.unlockCost;
                crop.unlocked = true;
                state.selectedCropKey = crop.id;
                state.previousCropKey = crop.id;
                state.needsRender = true;
                onMoneyChanged();
                renderCropOptions();
                closeAllMenus();
                saveState();
              },
              "Confirm Unlock"
            );
          }
          return;
        }
        state.selectedCropKey = crop.id;
        state.previousCropKey = crop.id;
        state.needsRender = true;
        renderCropOptions();
        closeAllMenus();
        saveState();
      });

      dom.plantCropMenu.appendChild(item);
      if (!crop.unlocked && !chainLocked) chainLocked = true;
    });
  }

  function renderCropOptions() {
    const now = Date.now();
    renderPlantCropMenu(now);
  }

  return {
    ensurePlantDefaults,
    renderCropOptions,
    getCropStatus,
    cropThumbSrc,
  };
}
