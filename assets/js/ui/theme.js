import { hexToRgba, darkenHex } from "../utils/colorUtils.js";

const STORAGE_KEY = "stockFarmerAccentColor";
const DEFAULT_ACCENT = "#4BBE4B";

let palette = buildPalette(DEFAULT_ACCENT);
const listeners = new Set();
let pickerInput = null;

function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) return null;
    return `#${trimmed.toUpperCase()}`;
}

function getContrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#0b1114" : "#f8fafc";
}

function buildPalette(color) {
    const accent = normalizeHex(color) || DEFAULT_ACCENT;
    return {
        accent,
        accentDark: darkenHex(accent, 0.8),
        accentSoft: hexToRgba(accent, 0.18),
        accentSofter: hexToRgba(accent, 0.12),
        accentBorder: hexToRgba(accent, 0.78),
        accentRing: hexToRgba(accent, 0.36),
        accentDimmed: hexToRgba(accent, 0.5),
        accentContrast: getContrastColor(accent),
    };
}

function applyPalette(nextPalette) {
    palette = nextPalette;
    const root = document.documentElement;
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--accent-strong", palette.accentDark);
    root.style.setProperty("--accent-soft", palette.accentSoft);
    root.style.setProperty("--accent-softer", palette.accentSofter);
    root.style.setProperty("--accent-border", palette.accentBorder);
    root.style.setProperty("--accent-ring", palette.accentRing);
    root.style.setProperty("--accent-contrast", palette.accentContrast);
    root.style.setProperty("--accent-dimmed", palette.accentDimmed);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", palette.accent);
    listeners.forEach((cb) => cb({ ...palette }));
}

function loadStoredAccent() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
        return null;
    }
}

function persistAccent(accent) {
    try {
        localStorage.setItem(STORAGE_KEY, accent);
    } catch (err) {
        return;
    }
}

export function initTheme() {
    const stored = normalizeHex(loadStoredAccent());
    const basePalette = buildPalette(stored || DEFAULT_ACCENT);
    applyPalette(basePalette);
}

export function setAccentColor(next) {
    const normalized = normalizeHex(next) || palette.accent || DEFAULT_ACCENT;
    persistAccent(normalized);
    applyPalette(buildPalette(normalized));
    if (pickerInput) pickerInput.value = normalized;
}

export function getAccentPalette() {
    return { ...palette };
}

export function onAccentChange(cb) {
    if (typeof cb !== "function") return () => {};
    listeners.add(cb);
    return () => listeners.delete(cb);
}

function handleAccentSelect(color) {
    setAccentColor(color);
}

function wireColorPicker(container) {
    if (!container) return;
    pickerInput = container.querySelector("#accentColorPicker");
    if (pickerInput) {
        pickerInput.value = palette.accent;
        pickerInput.addEventListener("input", (e) => {
            handleAccentSelect(e.target.value);
        });
    }
    const areas = container.querySelectorAll("area");
    areas.forEach((area) => {
        const color = area.getAttribute("alt") || area.dataset.color;
        if (!color) return;
        area.addEventListener("click", (e) => {
            e.preventDefault();
            handleAccentSelect(color);
        });
    });
    window.clickColor = handleAccentSelect;
}

export async function initThemePicker() {
    const slot = document.getElementById("themeCardSlot");
    if (!slot) return;
    try {
        const res = await fetch("fragments/color-picker.html");
        if (!res.ok) throw new Error("Failed to load color picker");
        const html = await res.text();
        slot.innerHTML = html;
    } catch (err) {
        slot.innerHTML = `
      <div class="rounded-xl border farm-border farm-bg-card p-4 space-y-3 shadow-inner shadow-black/20">
        <p class="text-xs uppercase tracking-wide farm-accent font-semibold">THEME</p>
        <div class="pt-2">
          <input id="accentColorPicker" type="color" value="${palette.accent}" class="w-full h-10 rounded border farm-border cursor-pointer" />
        </div>
      </div>
    `;
    }
    wireColorPicker(slot);
}
