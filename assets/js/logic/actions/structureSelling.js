export function buildStructureSelling(context, helpers) {
  const { state, world, config, formatCurrency, openConfirmModal, onMoneyChanged, saveState } = context;
  const { getStructureAtKey, getStructKind, getPlacementSource, removeStructure } = helpers;

  function collectStructureSellTargets(baseRow, baseCol, kindOverride = null) {
    const activeKind =
      kindOverride ||
      (state.activeMode === "build"
        ? "building"
        : state.activeMode === "landscape"
          ? "landscape"
          : null);
    if (!activeKind) return [];
    const targets = new Set();
    const selectedKey =
      activeKind === "landscape" ? state.selectedLandscapeKey : state.selectedBuildKey;
    const selected = selectedKey && selectedKey !== "sell" ? getPlacementSource(activeKind, selectedKey) : null;
    const width = Number.isInteger(selected?.width) && selected.width > 0 ? selected.width : 1;
    const height = Number.isInteger(selected?.height) && selected.height > 0 ? selected.height : 1;
    for (let dr = 0; dr < height; dr++) {
      for (let dc = 0; dc < width; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) continue;
        const key = `${row},${col}`;
        const structKey = getStructureAtKey(key);
        if (!structKey) continue;
        const struct = world.structures.get(structKey);
        if (struct && getStructKind(struct) === activeKind) targets.add(structKey);
      }
    }
    return Array.from(targets);
  }

  function getStructureSellSummary(structKeys, kind = null) {
    const seen = new Set();
    let count = 0;
    let total = 0;
    (structKeys || []).forEach((key) => {
      if (!key || seen.has(key)) return;
      seen.add(key);
      const struct = world.structures.get(key);
      if (!struct || (kind && getStructKind(struct) !== kind)) return;
      count += 1;
      const refund = Number.isFinite(struct.cost) ? struct.cost : 0;
      total += refund;
    });
    return { count, total };
  }

  function sellStructures(structKeys, kind = null) {
    const seen = new Set();
    let sold = 0;
    let totalRefund = 0;
    (structKeys || []).forEach((key) => {
      if (!key || seen.has(key)) return;
      seen.add(key);
      const result = removeStructure(key, kind || undefined);
      if (result.success) {
        sold += 1;
        totalRefund += result.refund;
      }
    });
    if (sold > 0) {
      if (totalRefund > 0) {
        state.totalMoney += totalRefund;
        onMoneyChanged();
      }
      state.needsRender = true;
      saveState();
    }
    return { sold, totalRefund };
  }

  function promptSellStructures(structKeys, kind = null) {
    const summary = getStructureSellSummary(structKeys, kind || undefined);
    if (!summary.count) return;
    const singleLabel =
      kind === "landscape" ? "landscape tile" : "building";
    const pluralLabel =
      kind === "landscape" ? "landscape tiles" : "buildings";
    const label = summary.count === 1 ? singleLabel : pluralLabel;
    const priceText = formatCurrency(summary.total || 0);
    openConfirmModal(
      `Sell ${summary.count} ${label} for ${priceText}?`,
      () => sellStructures(structKeys, kind || undefined),
      kind === "landscape" ? "Sell Landscapes" : "Sell Buildings",
      null,
      { confirmVariant: "danger", confirmText: "Sell" }
    );
  }

  return {
    collectStructureSellTargets,
    getStructureSellSummary,
    promptSellStructures,
    sellStructures,
  };
}
