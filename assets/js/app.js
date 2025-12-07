import { config } from "./config.js";
import { crops } from "./data/crops.js";
import { sizes } from "./data/sizes.js";
import { buildings } from "./data/buildings.js";
import { landscapes } from "./data/landscapes.js";
import { createBaseAssets, preloadCropImages } from "./assets/assetLoader.js";
import { createLandscapeAssets } from "./assets/landscapeAssets.js";
import { createInitialState, createInitialWorld, applyDefaultSelection, loadState, saveState, recalcPlacedCounts } from "./state/state.js";
import { getDomRefs } from "./ui/domRefs.js";
import { createUIControls } from "./controls/uiControls.js";
import { createViewport } from "./render/viewport.js";
import { createRenderer } from "./render/canvasRenderer.js";
import { createPointerControls } from "./controls/pointerControls.js";
import { createActions } from "./logic/actions.js";
import { formatCurrency } from "./utils/helpers.js";
import { registerGameContext, queueCloudSave, logOutAndReset } from "./firebase-auth.js";
import { createTradeModal } from "./trading/tradeModal.js";
import { createGameHud } from "./ui/gameHud.js";
import { initTheme, initThemePicker, initHudPicker, setAccentColor, getAccentPalette, onAccentChange, setHudContext } from "./ui/theme.js";

initTheme();

const canvas = document.getElementById("gridCanvas");
if (!canvas) throw new Error("Canvas element #gridCanvas not found");
const ctx = canvas.getContext("2d");

const state = createInitialState(config);
const world = createInitialWorld(config);
const dom = getDomRefs();
const assets = createBaseAssets(state);
const landscapeAssets = createLandscapeAssets({ landscapes, state });
preloadCropImages(crops, state);

const persistence = {
  save: (options = {}) => {
    const data = saveState({ state, world, crops, sizes, landscapes, config });
    if (!options.skipRemote) queueCloudSave(data);
    return data;
  },
  saveView: () => persistence.save({ skipRemote: true }),
  load: () => loadState({ state, world, crops, sizes, landscapes, config }),
};

persistence.load();
if (!localStorage.getItem(config.saveKey)) {
  applyDefaultSelection(state);
}
recalcPlacedCounts(world, crops, state);

let themeSyncReady = false;
onAccentChange((palette) => {
  state.accentColor = palette.accent;
  if (themeSyncReady) persistence.save();
});
const initialAccent = state.accentColor || getAccentPalette().accent;
setAccentColor(initialAccent);
state.accentColor = initialAccent;
themeSyncReady = true;

const viewport = createViewport({ canvas, ctx, state, config });

let ui;
let tradeModal;
let gameHud;

const onMoneyChanged = () => {
  if (ui) {
    ui.updateTotalDisplay();
    ui.renderCropOptions();
    ui.renderSizeMenu();
  }
  tradeModal?.refreshBalances();
  state.needsRender = true;
};

function resetFarm() {
  try {
    localStorage.clear();
  } catch (err) {
    console.error("Failed to clear storage", err);
  }
  window.location.reload();
}

async function clearCacheAndLogout() {
  await logOutAndReset({ clearCaches: true, showAuthOnReload: true });
}

function resetSettingsOnly() {
  try {
    localStorage.removeItem("stockFarmerAccentColor");
    state.accentColor = null;
    state.hudDockScale = 1.0;
    state.hudDropdownScale = 1.0;
    state.hudFontSize = 1.0;
    state.hudOpacity = 0.95;
    persistence.save();
  } catch (err) {
    console.error("Failed to clear settings", err);
  }
  window.location.reload();
}

ui = createUIControls({
  dom,
  state,
  crops,
  sizes,
  buildings,
  landscapes,
  formatCurrency,
  onMoneyChanged,
  saveState: persistence.save,
  centerView: viewport.centerView,
  resetFarm,
  clearCache: clearCacheAndLogout,
  resetSettings: resetSettingsOnly,
});

tradeModal = createTradeModal({
  state,
  onMoneyChanged,
  saveState: persistence.save,
});

gameHud = createGameHud({
  canvas,
  ctx,
  state,
  crops,
  sizes,
  landscapes,
  buildings,
  formatCurrency,
  onMoneyChanged,
  saveState: persistence.save,
  openConfirmModal: ui.openConfirmModal,
});

setHudContext({ state, saveState: persistence.save, gameHud });
initHudPicker();
initThemePicker();

registerGameContext({
  state,
  world,
  crops,
  sizes,
  buildings,
  landscapes,
  config,
  refreshUI: ui.refreshAllUI,
  openConfirmModal: ui.openConfirmModal,
});

const actions = createActions({
  state,
  world,
  config,
  crops,
  buildings,
  landscapes,
  currentSizeOption: ui.currentSizeOption,
  formatCurrency,
  onMoneyChanged,
  renderCropOptions: ui.renderCropOptions,
  renderLandscapeOptions: ui.renderLandscapeOptions,
  showAggregateMoneyChange: (amount) => gameHud.showMoneyChange(amount),
  saveState: persistence.save,
  openConfirmModal: ui.openConfirmModal,
  showActionError: ui.showActionError,
  tileFromClient: viewport.tileFromClient,
});

const renderer = createRenderer({
  canvas,
  ctx,
  state,
  world,
  config,
  crops,
  assets,
  landscapes,
  landscapeAssets,
  currentSizeOption: ui.currentSizeOption,
  computeHoverPreview: actions.computeHoverPreview,
  gameHud,
});

const pointerControls = createPointerControls({
  canvas,
  state,
  config,
  viewport,
  actions,
  openConfirmModal: ui.openConfirmModal,
  saveState: persistence.save,
  saveViewState: persistence.saveView,
  gameHud,
});

ui.bindUIEvents();
pointerControls.bind();
ui.refreshAllUI();
viewport.resizeCanvas();
renderer.loop();
setInterval(() => {
  state.needsRender = true;
}, 1000);

window.addEventListener("resize", () => {
  viewport.resizeCanvas();
  if (gameHud) gameHud.computeLayout();
  state.needsRender = true;
});

