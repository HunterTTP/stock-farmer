export const MODE_ORDER = ["plant", "harvest", "landscape", "build", "trade"];

export const LAYOUT = {
  mobile: { modeButtonSize: 46, minModeButtonSize: 44, maxModeButtonSize: 78, gap: 10, padding: 10, fontSize: 12, iconSize: 22, toolbarPadding: 8, toolbarMaxWidth: 680 },
  tablet: { modeButtonSize: 52, minModeButtonSize: 50, maxModeButtonSize: 86, gap: 12, padding: 14, fontSize: 13, iconSize: 25, toolbarPadding: 10, toolbarMaxWidth: 760 },
  desktop: { modeButtonSize: 48, minModeButtonSize: 44, maxModeButtonSize: 72, gap: 12, padding: 12, fontSize: 12, iconSize: 23, toolbarPadding: 10, toolbarMaxWidth: 720 },
};

export const GOLD = "#d4af37";
export const GOLD_DIM = "rgba(212, 175, 55, 0.6)";

export function createColors(accentPalette, hexToRgba) {
  const COLORS = {
    toolbarBg: "rgba(38, 38, 38, 0.96)",
    toolbarBorder: "rgba(80, 80, 80, 0.6)",
    buttonBg: "rgba(50, 50, 50, 0.92)",
    buttonHover: "rgba(60, 60, 60, 0.95)",
    buttonActive: hexToRgba(accentPalette.accent, 0.32),
    buttonBorder: "rgba(80, 80, 80, 0.5)",
    buttonActiveBorder: accentPalette.accentBorder || hexToRgba(accentPalette.accent, 0.85),
    panelBg: "rgba(32, 32, 32, 0.97)",
    panelBorder: "rgba(80, 80, 80, 0.5)",
    itemBg: "rgba(45, 45, 45, 0.85)",
    itemHover: "rgba(55, 55, 55, 0.92)",
    itemSelected: accentPalette.accentSoft || hexToRgba(accentPalette.accent, 0.22),
    itemSelectedBorder: accentPalette.accentBorder || hexToRgba(accentPalette.accent, 0.85),
    text: "#e0e0e0",
    textHover: "#ffffff",
    textSecondary: "rgba(165, 165, 165, 0.85)",
    accent: accentPalette.accent,
    accentDark: accentPalette.accentDark || hexToRgba(accentPalette.accent, 0.8),
    money: accentPalette.accent,
    moneyBg: "rgba(38, 38, 38, 0.92)",
    moneyLoss: "#d94040",
    gold: GOLD,
    goldDimmed: GOLD_DIM,
    shadow: "rgba(0, 0, 0, 0.45)",
  };
  return COLORS;
}

export function applyAccentColors(COLORS, palette, hexToRgba) {
  const p = palette;
  COLORS.accent = p.accent;
  COLORS.accentDark = p.accentDark || hexToRgba(p.accent, 0.8);
  COLORS.money = p.accent;
  COLORS.buttonActiveBorder = p.accentBorder || hexToRgba(p.accent, 0.85);
  COLORS.itemSelectedBorder = p.accentBorder || hexToRgba(p.accent, 0.85);
  COLORS.itemSelected = p.accentSoft || hexToRgba(p.accent, 0.22);
  COLORS.buttonActive = p.accentSoft || hexToRgba(p.accent, 0.32);
}
