import { getBuildingFarmlandBoost, getFarmlandUsage } from "../../logic/farmlandLimits.js";

export function createStructureMenus({
  dom,
  state,
  world,
  crops,
  buildings,
  landscapes,
  formatCurrency,
  openConfirmModal,
  onMoneyChanged,
  closeAllMenus,
  saveState,
  sellIconSrc,
}) {
  function ensureBuildDefaults() {
    if (state.selectedBuildKey === "sell") return;
    if (state.selectedBuildKey && buildings?.[state.selectedBuildKey]) return;
    const first = Object.values(buildings || {}).find((b) => b && b.unlocked);
    state.selectedBuildKey = first ? first.id : "sell";
  }

  const getFarmlandStatus = () => getFarmlandUsage(state, world, null, crops);

  function ensureLandscapeDefaults() {
    if (state.selectedLandscapeKey === "sell") return;
    if (state.selectedLandscapeKey && landscapes?.[state.selectedLandscapeKey] && !landscapes[state.selectedLandscapeKey].hidden) return;
    const first = Object.values(landscapes || {}).find((l) => l && l.unlocked && !l.hidden);
    state.selectedLandscapeKey = first ? first.id : "sell";
  }

  function renderBuildOptions() {
    ensureBuildDefaults();
    if (!dom.buildSelectMenu) {
      updateBuildLabel();
      return;
    }
    dom.buildSelectMenu.innerHTML = "";

    const setSelected = (id) => {
      state.selectedBuildKey = id;
      updateBuildLabel();
      state.needsRender = true;
      closeAllMenus();
      saveState();
    };

    const renderRow = (item) => {
      const farmlandBoost = item.id === "sell" ? 0 : getBuildingFarmlandBoost(item);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (item.id === state.selectedBuildKey) row.classList.add("border-accent", "bg-neutral-900/70");
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "w-8 h-8 rounded-sm border border-neutral-800 bg-neutral-900/60 flex items-center justify-center overflow-hidden";
      if (item.id === "sell") {
        const icon = document.createElement("div");
        icon.className = "text-accent font-black text-lg leading-none";
        icon.textContent = "$";
        thumbWrap.appendChild(icon);
      } else {
        const thumb = document.createElement("img");
        thumb.src = item.image || "images/farmland.jpg";
        thumb.alt = item.name;
        thumb.className = "max-w-full max-h-full object-contain";
        thumbWrap.appendChild(thumb);
      }
      row.appendChild(thumbWrap);

      const text = document.createElement("div");
      text.className = "flex-1 min-w-0";
      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-white truncate";
      title.textContent = item.name;
      const metaWrap = document.createElement("div");
      metaWrap.className = "flex flex-col gap-0.5";
      const meta = document.createElement("div");
      meta.className = "text-[11px] text-neutral-400 truncate";
      meta.textContent = item.id === "sell" ? "Remove and refund" : `${item.width}x${item.height} | ${formatCurrency(item.cost || 0)}`;
      metaWrap.appendChild(meta);
      if (farmlandBoost > 0) {
        const farmlandMeta = document.createElement("div");
        farmlandMeta.className = "text-[11px] text-neutral-400 truncate";
        farmlandMeta.textContent = `+${farmlandBoost} Farmland each`;
        metaWrap.appendChild(farmlandMeta);
      }
      text.appendChild(title);
      text.appendChild(metaWrap);
      row.appendChild(text);

      row.addEventListener("click", () => setSelected(item.id));
      return row;
    };

    const sellOption = renderRow({
      id: "sell",
      name: "Sell",
      width: 1,
      height: 1,
      cost: 0,
      image: sellIconSrc,
    });
    dom.buildSelectMenu.appendChild(sellOption);

    Object.values(buildings || {})
      .slice()
      .sort((a, b) => {
        const costA = Number.isFinite(a?.cost) ? a.cost : 0;
        const costB = Number.isFinite(b?.cost) ? b.cost : 0;
        return costA - costB;
      })
      .forEach((b) => {
        if (!b) return;
        dom.buildSelectMenu.appendChild(renderRow(b));
      });

    updateBuildLabel();
  }

  function updateBuildLabel() {
    if (dom.buildSelectLabel) {
      if (state.selectedBuildKey === "sell") {
        dom.buildSelectLabel.textContent = "Sell";
      } else {
        const selected = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
        dom.buildSelectLabel.textContent = selected ? selected.name : "Select";
      }
    }
    if (dom.buildSelectImage) {
      if (state.selectedBuildKey === "sell") {
        dom.buildSelectImage.src = sellIconSrc;
        dom.buildSelectImage.alt = "Sell";
      } else {
        const selected = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
        dom.buildSelectImage.src = selected?.image || "images/farmland.jpg";
        dom.buildSelectImage.alt = selected?.name || "Build";
      }
    }
  }

  function renderLandscapeOptions() {
    ensureLandscapeDefaults();
    if (!dom.landscapeSelectMenu) {
      updateLandscapeLabel();
      return;
    }
    dom.landscapeSelectMenu.innerHTML = "";

    const farmlandStatus = getFarmlandStatus();
    const farmlandLimitText = `${farmlandStatus.placed}/${farmlandStatus.limit} tiles`;

    const setSelected = (id) => {
      state.selectedLandscapeKey = id;
      updateLandscapeLabel();
      state.needsRender = true;
      closeAllMenus();
      saveState();
    };

    const renderRow = (item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (item.id === state.selectedLandscapeKey) row.classList.add("border-accent", "bg-neutral-900/70");
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "w-8 h-8 rounded-sm border border-neutral-800 bg-neutral-900/60 flex items-center justify-center overflow-hidden";
      if (item.id === "sell") {
        const icon = document.createElement("div");
        icon.className = "text-accent font-black text-lg leading-none";
        icon.textContent = "$";
        thumbWrap.appendChild(icon);
      } else {
        const thumb = document.createElement("img");
        thumb.src = item.image || "images/farmland.jpg";
        thumb.alt = item.name;
        thumb.className = "max-w-full max-h-full object-contain";
        thumbWrap.appendChild(thumb);
      }
      row.appendChild(thumbWrap);

      const text = document.createElement("div");
      text.className = "flex-1 min-w-0";
      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-white truncate";
      title.textContent = item.name;
      const metaWrap = document.createElement("div");
      metaWrap.className = "flex flex-col gap-0.5";
      const meta = document.createElement("div");
      meta.className = "text-[11px] text-neutral-400 truncate";
      if (item.id === "sell") {
        meta.textContent = "Remove and refund";
        metaWrap.appendChild(meta);
      } else if (item.isFarmland) {
        meta.textContent = `Free | ${farmlandLimitText}`;
        metaWrap.appendChild(meta);
      } else {
        const costValue = item.cost || 0;
        meta.textContent = costValue === 0 ? "Free" : `${formatCurrency(costValue)}`;
        metaWrap.appendChild(meta);
      }
      text.appendChild(title);
      text.appendChild(metaWrap);
      row.appendChild(text);

      row.addEventListener("click", () => setSelected(item.id));
      return row;
    };

    const sellOption = renderRow({
      id: "sell",
      name: "Destroy",
      width: 1,
      height: 1,
      cost: 0,
      image: sellIconSrc,
    });
    dom.landscapeSelectMenu.appendChild(sellOption);

    Object.values(landscapes || {}).forEach((landscape) => {
      if (!landscape || landscape.hidden) return;
      dom.landscapeSelectMenu.appendChild(renderRow(landscape));
    });

    updateLandscapeLabel();
  }

  function updateLandscapeLabel() {
    if (dom.landscapeSelectLabel) {
      if (state.selectedLandscapeKey === "sell") {
        dom.landscapeSelectLabel.textContent = "Destroy";
      } else {
        const selected = state.selectedLandscapeKey ? landscapes[state.selectedLandscapeKey] : null;
        dom.landscapeSelectLabel.textContent = selected ? selected.name : "Select";
      }
    }
    if (dom.landscapeSelectImage) {
      if (state.selectedLandscapeKey === "sell") {
        dom.landscapeSelectImage.src = sellIconSrc;
        dom.landscapeSelectImage.alt = "Destroy";
      } else {
        const selected = state.selectedLandscapeKey ? landscapes[state.selectedLandscapeKey] : null;
        dom.landscapeSelectImage.src = selected?.image || "images/farmland.jpg";
        dom.landscapeSelectImage.alt = selected?.name || "Landscape";
      }
    }
  }

  return {
    ensureBuildDefaults,
    ensureLandscapeDefaults,
    renderBuildOptions,
    renderLandscapeOptions,
    updateBuildLabel,
    updateLandscapeLabel,
  };
}
