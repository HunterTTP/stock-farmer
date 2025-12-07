export function createMenuState({ dom, uiState, renderCropOptions, renderBuildOptions, renderLandscapeOptions }) {
  const menuMap = {
    plantCrop: () => ({ button: dom.plantCropButton, menu: dom.plantCropMenu }),
    plantSize: () => ({ button: dom.plantSizeButton, menu: dom.plantSizeMenu }),
    buildSelect: () => ({ button: dom.buildSelectButton, menu: dom.buildSelectMenu }),
    landscapeSelect: () => ({ button: dom.landscapeSelectButton, menu: dom.landscapeSelectMenu }),
  };

  const closeAllMenus = () => {
    Object.values(menuMap).forEach((get) => {
      const { menu } = get();
      if (menu) menu.classList.add("hidden");
    });
    uiState.openMenuKey = null;
  };

  const toggleMenu = (key) => {
    const entry = menuMap[key]?.();
    if (!entry || !entry.menu) return;
    const shouldOpen = uiState.openMenuKey !== key;
    closeAllMenus();
    if (shouldOpen) {
      if (key === "plantCrop") renderCropOptions();
      if (key === "buildSelect") renderBuildOptions();
      if (key === "landscapeSelect") renderLandscapeOptions();
      entry.menu.classList.remove("hidden");
      uiState.openMenuKey = key;
    }
  };

  const bindMenuToggle = (button, key) => {
    if (!button) return;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(key);
    });
  };

  return {
    menuMap,
    closeAllMenus,
    toggleMenu,
    bindMenuToggle,
  };
}
