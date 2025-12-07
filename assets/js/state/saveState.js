import { buildSaveData } from "./buildSaveData.js";

export function saveState({ state, world, crops, sizes, landscapes = {}, config }) {
  const data = buildSaveData({ state, world, crops, sizes, landscapes, config });
  try {
    localStorage.setItem(config.saveKey, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save state", err);
  }
  return data;
}
