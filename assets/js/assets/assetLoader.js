export function createBaseAssets(state) {
  const assets = {
    farmland: { img: new Image(), loaded: false },
    farmland_saturated: { img: new Image(), loaded: false },
    grass: { img: new Image(), loaded: false },
  };

  assets.farmland.img.src = "images/farmland.jpg";
  assets.farmland.img.onload = () => {
    assets.farmland.loaded = true;
    state.needsRender = true;
  };

  assets.farmland_saturated.img.src = "images/farmland_saturated.jpg";
  assets.farmland_saturated.img.onload = () => {
    assets.farmland_saturated.loaded = true;
    state.needsRender = true;
  };

  assets.grass.img.src = "images/grass.jpg";
  assets.grass.img.onload = () => {
    assets.grass.loaded = true;
    state.needsRender = true;
  };

  return assets;
}

export function preloadCropImages(crops, state) {
  Object.values(crops)
    .filter((c) => c.id !== "grass" && c.id !== "farmland")
    .forEach((crop) => {
      crop.growTimeMs = crop.growMinutes * 60 * 1000;
      crop.images = Array.from({ length: 4 }, (_, i) => {
        const img = new Image();
        img.src = `images/crops/${crop.id}/${crop.id}-phase-${i + 1}.png`;
        img.onload = () => (state.needsRender = true);
        return img;
      });
    });
}
