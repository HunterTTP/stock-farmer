import { hexToRgba, darkenHex } from "../utils/colorUtils.js";

export const DEFAULT_ACCENT = "#87FF85";

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

export function initTheme(initialAccent = null) {
    const basePalette = buildPalette(initialAccent || DEFAULT_ACCENT);
    applyPalette(basePalette);
}

export function setAccentColor(next) {
    const normalized = normalizeHex(next) || palette.accent || DEFAULT_ACCENT;
    applyPalette(buildPalette(normalized));
    if (pickerInput) pickerInput.value = normalized;
}

export function getAccentPalette() {
    return { ...palette };
}

export function onAccentChange(cb) {
    if (typeof cb !== "function") return () => { };
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

let hudContext = null;

function wireHudSliders(container) {
    if (!container || !hudContext) return;
    const { state, saveState, gameHud } = hudContext;

    const fontSlider = container.querySelector("#hudFontSizeSlider");
    const fontValue = container.querySelector("#hudFontSizeValue");

    if (fontSlider && fontValue) {
        const fontMin = Number.isFinite(parseFloat(fontSlider.min)) ? parseFloat(fontSlider.min) : 0.4;
        const fontMax = Number.isFinite(parseFloat(fontSlider.max)) ? parseFloat(fontSlider.max) : 1.4;
        const clampFont = (val) => {
            const parsed = parseFloat(val);
            if (!Number.isFinite(parsed)) return 1.0;
            return Math.min(fontMax, Math.max(fontMin, parsed));
        };
        const formatFontSizeLabel = (clampedVal, layout) => {
            if (layout?.layout?.fontSize) {
                return `${Math.round(layout.layout.fontSize)}px`;
            }
            const fontSizeBase = 1.1;
            const fontSizeOffset = 0.1;
            const fallbackBase = 12;
            const scaled = Math.round(fallbackBase * (clampedVal + fontSizeOffset) * fontSizeBase);
            return `${scaled}px`;
        };
        const initialFont = clampFont(state.hudFontSize || 1.0);
        if (initialFont !== state.hudFontSize && Number.isFinite(state.hudFontSize)) {
            state.hudFontSize = initialFont;
        }
        fontSlider.value = initialFont;
        const initialLayout = gameHud ? gameHud.computeLayout() : null;
        fontValue.textContent = formatFontSizeLabel(initialFont, initialLayout);
        fontSlider.addEventListener("input", (e) => {
            const val = clampFont(e.target.value);
            fontSlider.value = val;
            state.hudFontSize = val;
            const computedLayout = gameHud ? gameHud.computeLayout() : null;
            fontValue.textContent = formatFontSizeLabel(val, computedLayout);
            state.needsRender = true;
        });
        fontSlider.addEventListener("change", () => {
            if (saveState) saveState();
        });
    }

    const transparencySlider = container.querySelector("#hudTransparencySlider");
    const transparencyValue = container.querySelector("#hudTransparencyValue");
    if (transparencySlider && transparencyValue) {
        const currentOpacity = typeof state.hudOpacity === "number" ? state.hudOpacity : 1.0;
        transparencySlider.value = Math.round(currentOpacity * 100);
        transparencyValue.textContent = `${Math.round(currentOpacity * 100)}%`;
        transparencySlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value) / 100;
            state.hudOpacity = val;
            transparencyValue.textContent = `${Math.round(val * 100)}%`;
            if (gameHud) gameHud.computeLayout();
            state.needsRender = true;
        });
        transparencySlider.addEventListener("change", () => {
            if (saveState) saveState();
        });
    }
}

export function setHudContext(ctx) {
    hudContext = ctx;
}

export async function initHudPicker() {
    const slot = document.getElementById("hudCardSlot");
    if (!slot) return;
    try {
        const res = await fetch("fragments/hud-settings.html");
        if (!res.ok) throw new Error("Failed to load HUD settings");
        const html = await res.text();
        slot.innerHTML = html;
    } catch (err) {
        slot.innerHTML = "";
    }
    wireHudSliders(slot);
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
