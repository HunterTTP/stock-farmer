import { config } from "./config.js";
import { crops } from "./data/crops.js";
import { sizes } from "./data/sizes.js";
import { buildings } from "./data/buildings.js";
import { createBaseAssets, preloadCropImages } from "./assets/assetLoader.js";
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

const canvas = document.getElementById("gridCanvas");
if (!canvas) throw new Error("Canvas element #gridCanvas not found");
const ctx = canvas.getContext("2d");

const state = createInitialState(config);
const world = createInitialWorld(config);
const dom = getDomRefs();
const assets = createBaseAssets(state);
preloadCropImages(crops, state);

const persistence = {
  save: (options = {}) => {
    const data = saveState({ state, world, crops, sizes, config });
    if (!options.skipRemote) queueCloudSave(data);
    return data;
  },
  saveView: () => persistence.save({ skipRemote: true }),
  load: () => loadState({ state, world, crops, sizes, config }),
};

persistence.load();
if (!localStorage.getItem(config.saveKey)) {
  applyDefaultSelection(state);
}
recalcPlacedCounts(world, crops);

const viewport = createViewport({ canvas, ctx, state, config });

let ui;
let tradeModal;
const onMoneyChanged = () => {
  if (ui) {
    ui.updateTotalDisplay();
    ui.renderCropOptions();
    ui.renderSizeMenu();
  }
  tradeModal?.refreshBalances();
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

ui = createUIControls({
  dom,
  state,
  crops,
  sizes,
  buildings,
  formatCurrency,
  onMoneyChanged,
  saveState: persistence.save,
  centerView: viewport.centerView,
  resetFarm,
  clearCache: clearCacheAndLogout,
});

tradeModal = createTradeModal({
  state,
  onMoneyChanged,
  saveState: persistence.save,
});

registerGameContext({
  state,
  world,
  crops,
  sizes,
  buildings,
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
  currentSizeOption: ui.currentSizeOption,
  formatCurrency,
  onMoneyChanged,
  renderCropOptions: ui.renderCropOptions,
  showAggregateMoneyChange: ui.showAggregateMoneyChange,
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
  currentSizeOption: ui.currentSizeOption,
  computeHoverPreview: actions.computeHoverPreview,
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
  state.needsRender = true;
});
