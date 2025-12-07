import { buildStructureHelpers } from "./actions/helpers.js";
import { buildDetermineAction } from "./actions/determineAction.js";
import { buildPreview } from "./actions/preview.js";
import { buildCropOperations } from "./actions/cropOperations.js";
import { buildStructureSelling } from "./actions/structureSelling.js";
import { buildActionHandler } from "./actions/handleTileAction.js";
import { buildTapHandler } from "./actions/handleTap.js";

export function createActions(args) {
  const context = { ...args };
  const helpers = buildStructureHelpers(context);
  context.getPlacementSource = helpers.getPlacementSource;

  const { determineActionForTile } = buildDetermineAction(context, helpers);
  const cropOps = buildCropOperations(context);
  const structureSelling = buildStructureSelling(context, helpers);
  const { computeHoverPreview } = buildPreview(context, determineActionForTile);
  const { handleTileAction } = buildActionHandler(context, helpers, determineActionForTile, cropOps);
  const { handleTap } = buildTapHandler(context, determineActionForTile, handleTileAction);

  return {
    determineActionForTile,
    computeHoverPreview,
    collectHoeDestroyTargets: cropOps.collectHoeDestroyTargets,
    collectStructureSellTargets: structureSelling.collectStructureSellTargets,
    promptSellStructures: structureSelling.promptSellStructures,
    handleTileAction,
    handleTap,
    destroyPlot: cropOps.destroyPlot,
  };
}
