export function buildTapHandler(context, determineActionForTile, handleTileAction) {
  const { state, currentSizeOption, tileFromClient, showActionError, showAggregateMoneyChange } = context;

  function handleTap(clientX, clientY) {
    const startMoney = state.totalMoney;
    const tile = tileFromClient(clientX, clientY);
    if (!tile) return;
    const sizeOption = currentSizeOption();
    const isPlacementMode = state.activeMode === "build" || state.activeMode === "landscape";
    const size = isPlacementMode ? 1 : sizeOption.size || 1;
    const baseRow = tile.row;
    const baseCol = tile.col;
    const isHarvestMode = state.activeMode === "harvest";
    const baseAction = isHarvestMode ? null : determineActionForTile(baseRow, baseCol);
    let failure = null;
    let hadSuccess = false;
    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        const actionForCell = isHarvestMode ? determineActionForTile(row, col) : baseAction;
        const result = handleTileAction(row, col, actionForCell);
        if (result.success) {
          hadSuccess = true;
          continue;
        }
        const reason = (actionForCell && actionForCell.reason) || result.reason;
        if (!reason || failure) continue;
        failure = { reason, x: clientX, y: clientY };
      }
    }
    if (!hadSuccess && failure) showActionError(failure.reason, failure.x, failure.y);
    const delta = state.totalMoney - startMoney;
    if (delta !== 0 && typeof showAggregateMoneyChange === "function") {
      showAggregateMoneyChange(delta);
    }
  }

  return { handleTap };
}
