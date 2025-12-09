import { getCropGrowTimeMs } from "../../utils/helpers.js";

export function createMenuData({ state, crops, sizes, landscapes, buildings, formatCurrency }) {
  const formatDurationMs = (ms) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}hr`);
    if (hrs > 0 || mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(" ");
  };

  const formatGrowTime = (minutes) => {
    if (!Number.isFinite(minutes)) return "";
    if (minutes > 0 && minutes < 1) {
      const secs = Math.round(minutes * 60);
      return `${secs}s`;
    }
    if (minutes === 60) return "1hr";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0 && mins === 0) return `${hrs}hr`;
    if (hrs > 0) return `${hrs}hr ${mins}m`;
    return `${minutes}m`;
  };

  const getCropStatus = (crop) => {
    if (!crop) return null;
    if (!crop.placed || crop.placed <= 0) return null;
    const plantedAt = Number.isFinite(crop.lastPlantedAt) ? crop.lastPlantedAt : null;
    if (!plantedAt || plantedAt <= 0) return { count: crop.placed, harvestText: "Ready" };
    const growMs =
      Number.isFinite(crop.lastPlantedGrowMs) && crop.lastPlantedGrowMs > 0
        ? crop.lastPlantedGrowMs
        : getCropGrowTimeMs(crop);
    if (!growMs || growMs <= 0) return { count: crop.placed, harvestText: "Ready" };
    const nowMs = Date.now();
    const remainingMs = Math.max(0, growMs - (nowMs - plantedAt));
    if (remainingMs <= 0) return { count: crop.placed, harvestText: "Ready" };
    return { count: crop.placed, harvestText: formatDurationMs(remainingMs) };
  };

  const getDropdownLabel = (dropdown) => {
    if (dropdown.id === "cropSelect") {
      const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
      return crop ? crop.name : "Select Crop";
    }
    if (dropdown.id === "sizeSelect") {
      const size = sizes[state.selectedSizeKey];
      return size ? size.name : "Size";
    }
    if (dropdown.id === "landscapeSelect") {
      if (state.selectedLandscapeKey === "sell") return "Destroy";
      const landscape = state.selectedLandscapeKey ? landscapes[state.selectedLandscapeKey] : null;
      return landscape ? landscape.name : "Select";
    }
    if (dropdown.id === "buildSelect") {
      if (state.selectedBuildKey === "sell") return "Sell";
      const building = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
      return building ? building.name : "Select";
    }
    return "Select";
  };

  const getDropdownMeta = (dropdown) => {
    if (dropdown.id === "cropSelect") {
      const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
      if (crop) {
        const status = getCropStatus(crop);
        if (status) {
          return `Planted: ${status.count} | ${status.harvestText}`;
        }
        return `Sells for ${formatCurrency(crop.baseValue)} - ${formatGrowTime(crop.growMinutes)}`;
      }
      return null;
    }
    if (dropdown.id === "landscapeSelect") {
      if (state.selectedLandscapeKey === "sell") {
        return "Remove landscape";
      }
      const landscape = state.selectedLandscapeKey ? landscapes[state.selectedLandscapeKey] : null;
      if (landscape) {
        const cost = landscape.isFarmland && state.farmlandPlaced < 4 ? 0 : landscape.cost || 0;
        return cost === 0 ? "Free" : `${formatCurrency(cost)}`;
      }
      return null;
    }
    if (dropdown.id === "buildSelect") {
      if (state.selectedBuildKey === "sell") {
        return "Remove and refund";
      }
      const building = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
      if (building) {
        return `${building.width}x${building.height} | ${formatCurrency(building.cost || 0)}`;
      }
      return null;
    }
    return null;
  };

  const getDropdownPreviewData = (dropdown) => {
    if (dropdown.id === "cropSelect") {
      const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
      if (crop) {
        return { imageUrl: `images/crops/${crop.id}/${crop.id}-phase-4.png` };
      }
      return { imageUrl: null };
    }
    if (dropdown.id === "sizeSelect") {
      return null;
    }
    if (dropdown.id === "landscapeSelect") {
      if (state.selectedLandscapeKey === "sell") {
        return { iconType: "fa", faGlyph: "\uf2ed" };
      }
      const landscape = state.selectedLandscapeKey ? landscapes[state.selectedLandscapeKey] : null;
      if (landscape) {
        return { imageUrl: landscape.image || null, colorData: landscape.lowColor || null };
      }
      return { imageUrl: null };
    }
    if (dropdown.id === "buildSelect") {
      if (state.selectedBuildKey === "sell") {
        return { iconType: "fa", faGlyph: "\uf81d" };
      }
      const building = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
      if (building) {
        return { imageUrl: building.image || null, colorData: building.colorData || null };
      }
      return { imageUrl: null };
    }
    return { imageUrl: null };
  };

  const getMenuItems = (dropdown) => {
    if (dropdown.id === "cropSelect") {
      const cropKeys = Object.keys(crops);
      return cropKeys.map((key, index) => {
        const crop = crops[key];
        const status = getCropStatus(crop);
        const baseMeta = `Sells for ${formatCurrency(crop.baseValue)} - ${formatGrowTime(crop.growMinutes)}`;
        const metaLines = [{ text: baseMeta, type: "meta" }];
        if (status) {
          metaLines.push({ text: `Planted: ${status.count} | ${status.harvestText}`, type: "status" });
        }
        if (!crop.unlocked && crop.unlockCost > 0) {
          metaLines.push({ text: `Unlock for ${formatCurrency(crop.unlockCost)}`, type: "unlock" });
        }

        const prereqsMet = index === 0 || cropKeys.slice(0, index).every((prevKey) => crops[prevKey].unlocked);
        const hasMoney = state.totalMoney >= (crop.unlockCost || 0);
        const canAfford = crop.unlocked || (prereqsMet && hasMoney);

        return {
          id: crop.id,
          label: crop.name,
          meta: baseMeta,
          metaLines,
          locked: !crop.unlocked,
          unlockCost: crop.unlockCost || 0,
          canAfford,
          imageUrl: `images/crops/${crop.id}/${crop.id}-phase-4.png`,
          requiresPrevious: !prereqsMet,
          unlocked: !!crop.unlocked,
        };
      });
    }

    if (dropdown.id === "sizeSelect") {
      const sizeKeys = Object.keys(sizes);
      return sizeKeys.map((key, index) => {
        const size = sizes[key];
        const allPreviousUnlocked = index === 0 || sizeKeys.slice(0, index).every((prevKey) => sizes[prevKey].unlocked);
        const hasMoney = state.totalMoney >= (size.unlockCost || 0);
        const canAfford = size.unlocked || (allPreviousUnlocked && hasMoney);
        return {
          id: size.id,
          label: size.name,
          meta: "",
          locked: !size.unlocked,
          unlockCost: size.unlockCost || 0,
          canAfford,
          imageUrl: null,
          gridSize: size.size || 1,
          iconType: "faSquares",
          unlocked: !!size.unlocked,
        };
      });
    }

    if (dropdown.id === "landscapeSelect") {
      const farmlandPlaced = state.farmlandPlaced || 0;
      const base = [
        {
          id: "sell",
          label: "Destroy",
          meta: "Remove",
          locked: false,
          unlockCost: 0,
          canAfford: true,
          imageUrl: null,
          iconType: "fa",
          faGlyph: "\uf2ed",
        },
        {
          id: "farmland",
          label: "Farmland",
          meta: farmlandPlaced < 4 ? "Free" : `${formatCurrency(25)}`,
          locked: false,
          unlockCost: farmlandPlaced < 4 ? 0 : 25,
          canAfford: state.totalMoney >= (farmlandPlaced < 4 ? 0 : 25),
          imageUrl: "images/farmland.jpg",
          isFarmland: true,
          unlocked: true,
        },
      ];

      const landscapeList = Object.values(landscapes || {})
        .filter((landscape) => landscape && landscape.id !== "farmland" && !landscape.hidden)
        .map((landscape) => ({
          id: landscape.id,
          label: landscape.name,
          meta: landscape.cost === 0 ? "Free" : `${formatCurrency(landscape.cost || 0)}`,
          locked: !landscape.unlocked,
          unlockCost: landscape.cost || 0,
          canAfford: state.totalMoney >= (landscape.cost || 0),
          imageUrl: landscape.image || null,
          colorData: landscape.lowColor || null,
          unlocked: !!landscape.unlocked,
        }));

      return base.concat(landscapeList);
    }

    if (dropdown.id === "buildSelect") {
      const base = [
        {
          id: "sell",
          label: "Sell",
          meta: "Remove",
          locked: false,
          unlockCost: 0,
          canAfford: true,
          imageUrl: null,
          iconType: "fa",
          faGlyph: "\uf81d",
          faWeight: 900,
          faScale: 0.9,
          unlocked: true,
        },
      ];

      const buildList = Object.values(buildings || {}).map((building) => ({
        id: building.id,
        label: building.name,
        meta: `${building.width}x${building.height} | ${formatCurrency(building.cost || 0)}`,
        locked: !building.unlocked,
        unlockCost: building.cost || 0,
        canAfford: state.totalMoney >= (building.cost || 0),
        imageUrl: building.image || null,
        unlocked: !!building.unlocked,
      }));

      return base.concat(buildList);
    }

    return [];
  };

  const isItemSelected = (dropdown, item) => {
    if (dropdown.id === "cropSelect") return item.id === state.selectedCropKey;
    if (dropdown.id === "sizeSelect") return item.id === state.selectedSizeKey;
    if (dropdown.id === "landscapeSelect") return item.id === state.selectedLandscapeKey;
    if (dropdown.id === "buildSelect") return item.id === state.selectedBuildKey;
    return false;
  };

  return {
    formatDurationMs,
    formatGrowTime,
    getCropStatus,
    getDropdownLabel,
    getDropdownMeta,
    getDropdownPreviewData,
    getMenuItems,
    isItemSelected,
  };
}
