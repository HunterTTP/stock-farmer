export function buildStructureHelpers({ world, config, landscapes, buildings }) {
  const getStructureAtKey = (key) => world.structureTiles.get(key) || null;

  const getStructKind = (struct) => (struct && struct.kind === "landscape" ? "landscape" : "building");

  const getPlacementSource = (kind, id) => (kind === "landscape" ? landscapes?.[id] : buildings?.[id]);

  const canPlaceStructure = (row, col, building, opts = {}) => {
    if (!building) return false;
    const width = Number.isInteger(building.width) ? building.width : 0;
    const height = Number.isInteger(building.height) ? building.height : 0;
    if (width <= 0 || height <= 0) return false;
    if (row < 0 || col < 0 || row + height > config.gridRows || col + width > config.gridCols) return false;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const key = `${row + r},${col + c}`;
        if (world.structureTiles.has(key)) return false;
        if (!opts.allowFilled && world.plots.has(key)) return false;
        if (building.isFarmland && (world.filled.has(key) || world.plots.has(key))) return false;
      }
    }
    return true;
  };

  const removeStructure = (structKey, expectedKind = null) => {
    if (!structKey) return { success: false, refund: 0 };
    const struct = world.structures.get(structKey);
    if (!struct) return { success: false, refund: 0 };
    const kind = getStructKind(struct);
    if (expectedKind && kind !== expectedKind) return { success: false, refund: 0 };
    for (let r = 0; r < struct.height; r++) {
      for (let c = 0; c < struct.width; c++) {
        world.structureTiles.delete(`${struct.row + r},${struct.col + c}`);
      }
    }
    world.structures.delete(structKey);
    const refund = Number.isFinite(struct.cost) ? struct.cost : 0;
    return { success: true, refund, kind };
  };

  return {
    canPlaceStructure,
    getPlacementSource,
    getStructKind,
    getStructureAtKey,
    removeStructure,
  };
}
