import { hexToRgba } from "../utils/colorUtils.js";
import { getAccentPalette, onAccentChange } from "./theme.js";

export function createGameHud({ canvas, ctx, state, crops, sizes, landscapes, buildings, formatCurrency, onMoneyChanged, saveState, openConfirmModal }) {
    const hudState = {
        openMenuKey: null,
        hoverElement: null,
        pointerDown: false,
        pointerDownElement: null,
        moneyChangeAmount: 0,
        moneyChangeOpacity: 0,
        moneyChangeStart: 0,
        layout: null,
        menuScrollOffset: 0,
        menuDragStart: null,
        menuDragScrollStart: 0,
    };

    const LAYOUT = {
        mobile: { modeButtonSize: 46, minModeButtonSize: 44, maxModeButtonSize: 78, gap: 10, padding: 10, fontSize: 11, iconSize: 21, toolbarPadding: 8, toolbarMaxWidth: 680 },
        tablet: { modeButtonSize: 52, minModeButtonSize: 50, maxModeButtonSize: 86, gap: 12, padding: 14, fontSize: 12, iconSize: 24, toolbarPadding: 10, toolbarMaxWidth: 760 },
        desktop: { modeButtonSize: 48, minModeButtonSize: 44, maxModeButtonSize: 72, gap: 12, padding: 12, fontSize: 11, iconSize: 22, toolbarPadding: 10, toolbarMaxWidth: 720 },
    };

    const GOLD = "#d4af37";
    const GOLD_DIM = "rgba(212, 175, 55, 0.6)";

    const accentPalette = getAccentPalette();
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

    const applyAccentColors = (palette) => {
        const p = palette || getAccentPalette();
        COLORS.accent = p.accent;
        COLORS.accentDark = p.accentDark || hexToRgba(p.accent, 0.8);
        COLORS.money = p.accent;
        COLORS.buttonActiveBorder = p.accentBorder || hexToRgba(p.accent, 0.85);
        COLORS.itemSelectedBorder = p.accentBorder || hexToRgba(p.accent, 0.85);
        COLORS.itemSelected = p.accentSoft || hexToRgba(p.accent, 0.22);
        COLORS.buttonActive = p.accentSoft || hexToRgba(p.accent, 0.32);
    };

    applyAccentColors(accentPalette);
    onAccentChange((p) => {
        applyAccentColors(p);
        state.needsRender = true;
    });

    const imageCache = {};

    const MODE_ORDER = ["plant", "harvest", "landscape", "build", "trade"];

    function getLayout() {
        const width = canvas.clientWidth;
        if (width >= 1024) return { ...LAYOUT.desktop, breakpoint: "desktop" };
        if (width >= 640) return { ...LAYOUT.tablet, breakpoint: "tablet" };
        return { ...LAYOUT.mobile, breakpoint: "mobile" };
    }

    function computeLayout() {
        const layout = getLayout();
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        const modeCount = MODE_ORDER.length;
        const availableWidth = canvasWidth - layout.padding * 2;
        const targetToolbarWidth = Math.min(layout.toolbarMaxWidth || availableWidth, availableWidth);
        const buttonSize = Math.max(
            layout.minModeButtonSize,
            Math.min(
                layout.maxModeButtonSize,
                (targetToolbarWidth - layout.toolbarPadding * 2 - (modeCount - 1) * layout.gap) / modeCount
            )
        );
        const totalModeWidth = modeCount * buttonSize + (modeCount - 1) * layout.gap + layout.toolbarPadding * 2;
        const toolbarHeight = buttonSize + layout.toolbarPadding * 2;
        const toolbarX = (canvasWidth - totalModeWidth) / 2;
        const toolbarY = canvasHeight - toolbarHeight - layout.padding;

        const modeButtons = MODE_ORDER.map((mode, i) => ({
            id: mode,
            type: "modeButton",
            x: toolbarX + layout.toolbarPadding + i * (buttonSize + layout.gap),
            y: toolbarY + layout.toolbarPadding,
            width: buttonSize,
            height: buttonSize,
            mode,
        }));

        const toolbar = { x: toolbarX, y: toolbarY, width: totalModeWidth, height: toolbarHeight };

        const dropdownHeight = 44;
        const dropdownY = toolbarY - layout.gap - dropdownHeight;
        const dropdowns = computeDropdownLayout(canvasWidth, dropdownY, dropdownHeight, layout);

        const moneyHeight = 34;
        const moneyText = "$" + formatCurrency(state.totalMoney, true);
        ctx.font = `700 13px system-ui, -apple-system, sans-serif`;
        const moneyTextWidth = ctx.measureText(moneyText).width;
        const moneyWidth = 24 + moneyTextWidth;
        const moneyX = canvasWidth - moneyWidth - layout.padding;
        const moneyY = layout.padding;
        const moneyDisplay = { id: "money", type: "moneyDisplay", x: moneyX, y: moneyY, width: moneyWidth, height: moneyHeight };

        const moneyChangeX = moneyX - 80 - 8;
        const moneyChange = { id: "moneyChange", type: "moneyChange", x: moneyChangeX, y: moneyY, width: 80, height: moneyHeight };

        hudState.layout = { layout, modeButtons, dropdowns, moneyDisplay, moneyChange, toolbar };
        return hudState.layout;
    }

    function computeDropdownLayout(canvasWidth, y, height, layout) {
        const active = state.activeMode || "plant";
        const dropdowns = [];

        if (active === "plant") {
            const cropW = measureDropdownWidth("cropSelect", layout);
            const sizeW = measureDropdownWidth("sizeSelect", layout);
            const totalW = cropW + layout.gap + sizeW;
            const startX = (canvasWidth - totalW) / 2;
            dropdowns.push({ id: "cropSelect", type: "dropdown", x: startX, y, width: cropW, height, menu: "cropMenu" });
            dropdowns.push({ id: "sizeSelect", type: "dropdown", x: startX + cropW + layout.gap, y, width: sizeW, height, menu: "sizeMenu" });
        } else if (active === "harvest") {
            const sizeW = measureDropdownWidth("harvestSizeSelect", layout);
            const startX = (canvasWidth - sizeW) / 2;
            dropdowns.push({ id: "harvestSizeSelect", type: "dropdown", x: startX, y, width: sizeW, height, menu: "harvestSizeMenu" });
        } else if (active === "landscape") {
            const w = measureDropdownWidth("landscapeSelect", layout);
            const startX = (canvasWidth - w) / 2;
            dropdowns.push({ id: "landscapeSelect", type: "dropdown", x: startX, y, width: w, height, menu: "landscapeMenu" });
        } else if (active === "build") {
            const w = measureDropdownWidth("buildSelect", layout);
            const startX = (canvasWidth - w) / 2;
            dropdowns.push({ id: "buildSelect", type: "dropdown", x: startX, y, width: w, height, menu: "buildMenu" });
        }

        return dropdowns;
    }

    function measureDropdownWidth(dropdownId, layout) {
        const dropdown = { id: dropdownId };
        const label = getDropdownLabel(dropdown);
        const meta = getDropdownMeta(dropdown);
        const previewData = getDropdownPreviewData(dropdown);
        const hasPreview = previewData && (previewData.imageUrl || previewData.colorData || previewData.iconType);

        const previewWidth = hasPreview ? 28 + 8 : 0;
        const paddingLeft = hasPreview ? 10 : 12;
        const chevronWidth = 28;
        const paddingRight = 8;

        ctx.font = meta ? `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif` : `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
        const labelWidth = ctx.measureText(label).width;

        let textWidth = labelWidth;
        if (meta) {
            ctx.font = `400 ${layout.fontSize - 2}px system-ui, -apple-system, sans-serif`;
            const metaWidth = ctx.measureText(meta).width;
            textWidth = Math.max(labelWidth, metaWidth);
        }

        // Make dropdowns 30% wider for better usability
        return Math.ceil((paddingLeft + previewWidth + textWidth + chevronWidth + paddingRight) * 1.3);
    }

    function getDropdownPreviewData(dropdown) {
        if (dropdown.id === "cropSelect") {
            const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
            if (crop) {
                return { imageUrl: `images/crops/${crop.id}/${crop.id}-phase-4.png` };
            }
            return { imageUrl: null };
        }
        if (dropdown.id === "sizeSelect") {
            const size = sizes[state.selectedSizeKey];
            if (size) {
                return { iconType: "grid", gridSize: size.size };
            }
            return { iconType: "grid", gridSize: 1 };
        }
        if (dropdown.id === "harvestSizeSelect") {
            const size = sizes[state.selectedSizeKey];
            if (size) {
                return { iconType: "grid", gridSize: size.size };
            }
            return { iconType: "grid", gridSize: 1 };
        }
        if (dropdown.id === "landscapeSelect") {
            if (state.selectedLandscapeKey === "sell") {
                return { iconType: "trash" };
            }
            const landscape = state.selectedLandscapeKey ? landscapes[state.selectedLandscapeKey] : null;
            if (landscape) {
                return { imageUrl: landscape.image || null, colorData: landscape.lowColor || null };
            }
            return { imageUrl: null };
        }
        if (dropdown.id === "buildSelect") {
            if (state.selectedBuildKey === "sell") {
                return { iconType: "dollar" };
            }
            const building = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
            if (building) {
                return { imageUrl: building.image || null };
            }
            return { imageUrl: null };
        }
        return { imageUrl: null };
    }

    function drawRoundedRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawToolbar() {
        const computed = hudState.layout;
        if (!computed || !computed.toolbar) return;

        const { toolbar } = computed;
        const radius = 20;

        ctx.save();
        ctx.shadowColor = COLORS.shadow;
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;

        drawRoundedRect(toolbar.x, toolbar.y, toolbar.width, toolbar.height, radius);
        ctx.fillStyle = COLORS.toolbarBg;
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.strokeStyle = COLORS.toolbarBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    function drawButton(btn, isActive, isHover, isPressed) {
        const layout = hudState.layout?.layout || getLayout();
        const radius = 14;

        ctx.save();

        if (isActive || isHover || isPressed) {
            ctx.shadowColor = isActive ? hexToRgba(COLORS.accent, 0.3) : "rgba(0, 0, 0, 0.2)";
            ctx.shadowBlur = isActive ? 12 : 8;
            ctx.shadowOffsetY = 2;
        }

        drawRoundedRect(btn.x, btn.y, btn.width, btn.height, radius);

        let bgColor;
        if (isActive) {
            bgColor = COLORS.buttonActive;
        } else if (isPressed) {
            bgColor = "rgba(60, 60, 60, 0.95)";
        } else if (isHover) {
            bgColor = COLORS.buttonHover;
        } else {
            bgColor = COLORS.buttonBg;
        }
        ctx.fillStyle = bgColor;
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.strokeStyle = isActive ? COLORS.buttonActiveBorder : COLORS.buttonBorder;
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        const iconY = btn.y + btn.height * 0.38;
        const labelY = btn.y + btn.height * 0.78;
        const iconSize = layout.iconSize;

        drawModeIcon(btn.x + btn.width / 2, iconY, iconSize, btn.mode, isActive);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${layout.fontSize - 1}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = isActive ? COLORS.accent : COLORS.text;

        const label = btn.mode.charAt(0).toUpperCase() + btn.mode.slice(1);
        ctx.fillText(label, btn.x + btn.width / 2, labelY);

        ctx.restore();
    }

    function drawModeIcon(cx, cy, size, mode, isActive) {
        const color = isActive ? COLORS.accent : COLORS.text;
        const s = size * 0.4;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (mode === "plant") {
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.5, cy - s * 0.8);
            ctx.lineTo(cx + s * 0.5, cy - s * 0.8);
            ctx.lineTo(cx + s * 0.6, cy + s * 0.6);
            ctx.lineTo(cx - s * 0.6, cy + s * 0.6);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy - s * 0.1, s * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx, cy + s * 0.15);
            ctx.lineTo(cx - s * 0.2, cy + s * 0.45);
            ctx.moveTo(cx, cy + s * 0.15);
            ctx.lineTo(cx + s * 0.2, cy + s * 0.45);
            ctx.stroke();
        } else if (mode === "harvest") {
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.7, cy + s * 0.3);
            ctx.quadraticCurveTo(cx - s * 0.8, cy - s * 0.4, cx - s * 0.3, cy - s * 0.6);
            ctx.lineTo(cx + s * 0.3, cy - s * 0.6);
            ctx.quadraticCurveTo(cx + s * 0.8, cy - s * 0.4, cx + s * 0.7, cy + s * 0.3);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.5, cy + s * 0.3);
            ctx.lineTo(cx - s * 0.4, cy + s * 0.7);
            ctx.lineTo(cx + s * 0.4, cy + s * 0.7);
            ctx.lineTo(cx + s * 0.5, cy + s * 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy - s * 0.2, s * 0.15, 0, Math.PI * 2);
            ctx.fill();
        } else if (mode === "landscape") {
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.8, cy + s * 0.6);
            ctx.lineTo(cx - s * 0.8, cy - s * 0.6);
            ctx.lineTo(cx + s * 0.8, cy - s * 0.6);
            ctx.lineTo(cx + s * 0.8, cy + s * 0.6);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.5, cy + s * 0.2);
            ctx.lineTo(cx - s * 0.2, cy - s * 0.2);
            ctx.lineTo(cx + s * 0.1, cy + s * 0.1);
            ctx.lineTo(cx + s * 0.5, cy - s * 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.8, cy + s * 0.6);
            ctx.lineTo(cx + s * 0.8, cy + s * 0.6);
            ctx.stroke();
        } else if (mode === "build") {
            ctx.beginPath();
            ctx.moveTo(cx, cy - s * 0.8);
            ctx.lineTo(cx - s * 0.7, cy + s * 0.1);
            ctx.lineTo(cx - s * 0.7, cy + s * 0.8);
            ctx.lineTo(cx + s * 0.7, cy + s * 0.8);
            ctx.lineTo(cx + s * 0.7, cy + s * 0.1);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.rect(cx - s * 0.2, cy + s * 0.3, s * 0.4, s * 0.5);
            ctx.fill();
        } else if (mode === "trade") {
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.7, cy + s * 0.5);
            ctx.lineTo(cx - s * 0.3, cy - s * 0.1);
            ctx.lineTo(cx + s * 0.2, cy + s * 0.3);
            ctx.lineTo(cx + s * 0.7, cy - s * 0.6);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + s * 0.4, cy - s * 0.6);
            ctx.lineTo(cx + s * 0.7, cy - s * 0.6);
            ctx.lineTo(cx + s * 0.7, cy - s * 0.3);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawDropdown(dropdown, isOpen, isHover) {
        const layout = hudState.layout?.layout || getLayout();
        const radius = 12;
        const previewSize = 28;
        const previewMargin = 10;
        const previewData = getDropdownPreviewData(dropdown);
        const hasPreview = previewData && (previewData.imageUrl || previewData.colorData || previewData.iconType);

        ctx.save();

        ctx.shadowColor = COLORS.shadow;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;

        drawRoundedRect(dropdown.x, dropdown.y, dropdown.width, dropdown.height, radius);

        let bgColor;
        if (isOpen) {
            bgColor = "rgba(60, 60, 60, 0.98)";
        } else if (isHover) {
            bgColor = "rgba(70, 70, 70, 0.95)";
        } else {
            bgColor = COLORS.panelBg;
        }
        ctx.fillStyle = bgColor;
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.strokeStyle = isOpen ? COLORS.itemSelectedBorder : COLORS.panelBorder;
        ctx.lineWidth = isOpen ? 1.5 : 1;
        ctx.stroke();

        let textX = dropdown.x + 12;
        if (hasPreview) {
            const previewX = dropdown.x + previewMargin;
            const previewY = dropdown.y + (dropdown.height - previewSize) / 2;
            if (previewData.iconType === "trash") {
                drawTrashIcon(previewX, previewY, previewSize);
            } else if (previewData.iconType === "dollar") {
                drawDollarIcon(previewX, previewY, previewSize);
            } else if (previewData.iconType === "grid") {
                drawGridIcon(previewX, previewY, previewSize, previewData.gridSize);
            } else {
                drawPreviewImage(previewX, previewY, previewSize, previewData.imageUrl, previewData.colorData);
            }
            textX = dropdown.x + previewMargin + previewSize + 8;
        }

        const label = getDropdownLabel(dropdown);
        const meta = getDropdownMeta(dropdown);

        ctx.textAlign = "left";

        if (meta) {
            ctx.textBaseline = "middle";
            ctx.font = `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(label, textX, dropdown.y + dropdown.height / 2 - 7);

            ctx.font = `400 ${layout.fontSize - 2}px system-ui, -apple-system, sans-serif`;
            ctx.fillStyle = COLORS.textSecondary;
            ctx.fillText(meta, textX, dropdown.y + dropdown.height / 2 + 8);
        } else {
            ctx.textBaseline = "middle";
            ctx.font = `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(label, textX, dropdown.y + dropdown.height / 2);
        }

        drawChevron(dropdown.x + dropdown.width - 20, dropdown.y + dropdown.height / 2, 6, isOpen);

        ctx.restore();
    }

    function getDropdownLabel(dropdown) {
        if (dropdown.id === "cropSelect") {
            const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
            return crop ? crop.name : "Select Crop";
        }
        if (dropdown.id === "sizeSelect" || dropdown.id === "harvestSizeSelect") {
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
    }

    function getDropdownMeta(dropdown) {
        if (dropdown.id === "cropSelect") {
            const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
            if (crop) {
                const status = getCropStatus(crop);
                if (status) {
                    return `Planted: ${status.count} | ${status.harvestText}`;
                }
                return `$${formatCurrency(crop.baseValue)} - ${formatGrowTime(crop.growMinutes)}`;
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
                return cost === 0 ? "Free" : `$${formatCurrency(cost)}`;
            }
            return null;
        }
        if (dropdown.id === "buildSelect") {
            if (state.selectedBuildKey === "sell") {
                return "Remove and refund";
            }
            const building = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
            if (building) {
                return `${building.width}x${building.height} | $${formatCurrency(building.cost || 0)}`;
            }
            return null;
        }
        return null;
    }

    function truncateText(ctx, text, maxWidth) {
        const metrics = ctx.measureText(text);
        if (metrics.width <= maxWidth) return text;
        let truncated = text;
        while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + "...";
    }

    function drawChevron(x, y, size, isOpen) {
        ctx.save();
        ctx.strokeStyle = COLORS.textSecondary;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (isOpen) {
            ctx.moveTo(x - size, y + size * 0.5);
            ctx.lineTo(x, y - size * 0.5);
            ctx.lineTo(x + size, y + size * 0.5);
        } else {
            ctx.moveTo(x - size, y - size * 0.5);
            ctx.lineTo(x, y + size * 0.5);
            ctx.lineTo(x + size, y - size * 0.5);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawMoneyDisplay(elem) {
        const radius = 16;

        ctx.save();
        ctx.shadowColor = COLORS.shadow;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        drawRoundedRect(elem.x, elem.y, elem.width, elem.height, radius);
        ctx.fillStyle = COLORS.moneyBg;
        ctx.fill();

        ctx.shadowColor = "transparent";

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = `700 13px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "#d4af37";

        const moneyText = "$" + formatCurrency(state.totalMoney, true);
        const textX = elem.x + 12;
        const textY = elem.y + elem.height / 2;
        ctx.fillText(moneyText, textX, textY);

        ctx.restore();
    }

    function drawCoinIcon(x, y, size) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const r = size / 2 - 1;

        ctx.save();

        const gradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
        gradient.addColorStop(0, hexToRgba(COLORS.accent, 0.75));
        gradient.addColorStop(0.7, COLORS.accent);
        gradient.addColorStop(1, COLORS.accentDark);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = hexToRgba(COLORS.accent, 0.6);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold ${size * 0.55}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = hexToRgba(COLORS.accent, 0.8);
        ctx.fillText("$", cx, cy + 1);

        ctx.restore();
    }

    function drawMoneyChange(elem) {
        if (hudState.moneyChangeOpacity <= 0) return;

        const radius = 12;
        const amount = hudState.moneyChangeAmount;
        const isGain = amount >= 0;

        ctx.save();
        ctx.globalAlpha = hudState.moneyChangeOpacity;

        drawRoundedRect(elem.x, elem.y, elem.width, elem.height, radius);
        ctx.fillStyle = COLORS.moneyBg;
        ctx.fill();

        ctx.strokeStyle = isGain ? hexToRgba(COLORS.accent, 0.5) : "rgba(231, 76, 60, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 12px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = isGain ? COLORS.accent : COLORS.moneyLoss;

        const prefix = isGain ? "+" : "";
        ctx.fillText(prefix + formatCurrency(amount, true), elem.x + elem.width / 2, elem.y + elem.height / 2);

        ctx.restore();
    }

    function getOrLoadImage(src) {
        if (!src) return null;
        if (imageCache[src]) return imageCache[src];
        const img = new Image();
        img.src = src;
        img.onload = () => {
            state.needsRender = true;
        };
        imageCache[src] = img;
        return img;
    }

    function drawPreviewImage(x, y, size, imageSrc, colorData) {
        const radius = 4;
        const padding = 1;

        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.fillStyle = "rgba(64, 64, 64, 0.8)";
        ctx.fill();
        ctx.restore();

        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.clip();

        const innerX = x + padding;
        const innerY = y + padding;
        const innerSize = size - padding * 2;

        if (imageSrc) {
            const img = getOrLoadImage(imageSrc);
            if (img && img.complete && img.naturalWidth > 0) {
                const imgW = img.naturalWidth;
                const imgH = img.naturalHeight;
                const scale = Math.min(innerSize / imgW, innerSize / imgH);
                const drawW = imgW * scale;
                const drawH = imgH * scale;
                const drawX = innerX + (innerSize - drawW) / 2;
                const drawY = innerY + (innerSize - drawH) / 2;
                ctx.drawImage(img, drawX, drawY, drawW, drawH);
            }
        } else if (colorData) {
            const { r, g, b } = colorData;
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            drawRoundedRect(innerX, innerY, innerSize, innerSize, 2);
            ctx.fill();
        }

        ctx.restore();

        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    function drawGridIcon(x, y, size, gridSize) {
        const radius = 4;
        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.fillStyle = "rgba(64, 64, 64, 0.8)";
        ctx.fill();
        ctx.restore();

        const padding = size * 0.15;
        const innerSize = size - padding * 2;
        const cellSize = innerSize / gridSize;
        const gap = Math.max(1, cellSize * 0.15);
        const actualCellSize = (innerSize - gap * (gridSize - 1)) / gridSize;

        ctx.save();
        ctx.fillStyle = COLORS.accent;
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const cellX = x + padding + col * (actualCellSize + gap);
                const cellY = y + padding + row * (actualCellSize + gap);
                ctx.beginPath();
                ctx.roundRect(cellX, cellY, actualCellSize, actualCellSize, 1);
                ctx.fill();
            }
        }
        ctx.restore();

        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    function drawTrashIcon(x, y, size) {
        const radius = 4;
        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.fillStyle = "rgba(64, 64, 64, 0.8)";
        ctx.fill();
        ctx.restore();

        const cx = x + size / 2;
        const cy = y + size / 2;
        const s = size * 0.35;

        ctx.save();
        ctx.strokeStyle = COLORS.textSecondary;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s * 0.6);
        ctx.lineTo(cx + s, cy - s * 0.6);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - s * 0.7, cy - s * 0.6);
        ctx.lineTo(cx - s * 0.5, cy + s);
        ctx.lineTo(cx + s * 0.5, cy + s);
        ctx.lineTo(cx + s * 0.7, cy - s * 0.6);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - s * 0.3, cy - s * 0.6);
        ctx.lineTo(cx - s * 0.3, cy - s);
        ctx.lineTo(cx + s * 0.3, cy - s);
        ctx.lineTo(cx + s * 0.3, cy - s * 0.6);
        ctx.stroke();

        ctx.restore();

        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    function drawDollarIcon(x, y, size) {
        const radius = 4;
        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.fillStyle = "rgba(45, 45, 45, 0.9)";
        ctx.fill();
        ctx.restore();

        const cx = x + size / 2;
        const cy = y + size / 2;
        const coinR = size * 0.32;

        ctx.save();

        const gradient = ctx.createRadialGradient(cx - coinR * 0.25, cy - coinR * 0.25, 0, cx, cy, coinR);
        gradient.addColorStop(0, hexToRgba(COLORS.accent, 0.75));
        gradient.addColorStop(0.6, COLORS.accent);
        gradient.addColorStop(1, COLORS.accentDark);

        ctx.beginPath();
        ctx.arc(cx, cy, coinR, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = hexToRgba(COLORS.accent, 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold ${coinR * 1.2}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = hexToRgba(COLORS.accent, 0.85);
        ctx.fillText("$", cx, cy + 0.5);

        ctx.restore();

        ctx.save();
        drawRoundedRect(x, y, size, size, radius);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    function measureMenuWidth(items, layout) {
        const previewSize = 32;
        const previewMargin = 8;
        const textOffset = previewSize + previewMargin * 2;
        const padding = 32;
        const scrollbarWidth = 16;

        let maxWidth = 0;

        items.forEach((item) => {
            ctx.font = `600 ${layout.fontSize - 1}px system-ui, -apple-system, sans-serif`;
            const labelWidth = ctx.measureText(item.label).width;

            ctx.font = `400 ${layout.fontSize - 3}px system-ui, -apple-system, sans-serif`;
            let metaText = item.meta;
            if (item.locked && item.unlockCost > 0) {
                metaText = `Unlock for $${formatCurrency(item.unlockCost)}`;
            }
            const metaWidth = ctx.measureText(metaText || "").width;

            const textWidth = Math.max(labelWidth, metaWidth);
            const totalWidth = textOffset + textWidth + padding + scrollbarWidth;
            if (totalWidth > maxWidth) maxWidth = totalWidth;
        });

        return Math.max(maxWidth, 180);
    }

    function drawMenu(dropdown) {
        const items = getMenuItems(dropdown);
        if (!items || items.length === 0) return;

        const layout = hudState.layout?.layout || getLayout();
        const itemHeight = 48;
        const maxVisibleHeight = 300;
        const totalContentHeight = items.length * itemHeight;
        const menuContentHeight = Math.min(totalContentHeight, maxVisibleHeight);
        const menuHeight = menuContentHeight + 16;
        const menuWidth = measureMenuWidth(items, layout);

        // Ensure menu doesn't go off screen horizontally
        const padding = layout.padding || 12;
        let menuX = dropdown.x;
        const canvasWidth = canvas.clientWidth;

        // Clamp menu position to stay on screen
        if (menuX + menuWidth > canvasWidth - padding) {
            menuX = canvasWidth - menuWidth - padding;
        }
        if (menuX < padding) {
            menuX = padding;
        }

        const menuY = dropdown.y - menuHeight - 10;
        const radius = 14;
        const previewSize = 36;
        const previewMargin = 10;
        const textOffset = previewSize + previewMargin * 2;
        const scrollable = totalContentHeight > maxVisibleHeight;
        const maxScroll = scrollable ? totalContentHeight - maxVisibleHeight : 0;
        const scrollOffset = Math.max(0, Math.min(hudState.menuScrollOffset, maxScroll));

        ctx.save();

        ctx.shadowColor = COLORS.shadow;
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;

        drawRoundedRect(menuX, menuY, menuWidth, menuHeight, radius);
        ctx.fillStyle = COLORS.panelBg;
        ctx.fill();

        ctx.shadowColor = "transparent";

        ctx.strokeStyle = COLORS.panelBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.save();
        drawRoundedRect(menuX + 6, menuY + 8, menuWidth - 12, menuContentHeight, 8);
        ctx.clip();

        items.forEach((item, i) => {
            const itemYBase = menuY + 8 + i * itemHeight - scrollOffset;
            if (itemYBase + itemHeight < menuY + 8 || itemYBase > menuY + 8 + menuContentHeight) {
                return;
            }

            const itemX = menuX + 10;
            const itemY = itemYBase;
            const itemW = menuWidth - 20;
            const itemH = itemHeight - 6;
            const isSelected = isItemSelected(dropdown, item);
            const isHover = hudState.hoverElement?.id === `menuItem_${dropdown.id}_${i}`;

            drawRoundedRect(itemX, itemY, itemW, itemH, 8);
            if (isSelected) {
                ctx.fillStyle = COLORS.itemSelected;
                ctx.fill();
                ctx.strokeStyle = COLORS.itemSelectedBorder;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else if (isHover) {
                ctx.fillStyle = COLORS.itemHover;
                ctx.fill();
            } else {
                ctx.fillStyle = COLORS.itemBg;
                ctx.fill();
            }

            const previewX = itemX + previewMargin;
            const previewY = itemY + (itemH - previewSize) / 2;
            if (item.iconType === "trash") {
                drawTrashIcon(previewX, previewY, previewSize);
            } else if (item.iconType === "dollar") {
                drawDollarIcon(previewX, previewY, previewSize);
            } else if (item.iconType === "grid") {
                drawGridIcon(previewX, previewY, previewSize, item.gridSize || 1);
            } else {
                drawPreviewImage(previewX, previewY, previewSize, item.imageUrl, item.colorData);
            }

            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
            ctx.fillStyle = item.locked && !item.canAfford ? COLORS.textSecondary : COLORS.text;

            const labelY = itemY + itemH / 2 - 7;
            ctx.fillText(item.label, itemX + textOffset, labelY);

            ctx.font = `400 ${layout.fontSize - 2}px system-ui, -apple-system, sans-serif`;
            const metaY = itemY + itemH / 2 + 8;

            if (item.locked && item.unlockCost > 0) {
                ctx.fillStyle = item.canAfford ? COLORS.gold : COLORS.goldDimmed;
                ctx.fillText(`Unlock for ${formatCurrency(item.unlockCost)}`, itemX + textOffset, metaY);
            } else {
                ctx.fillStyle = COLORS.textSecondary;
                ctx.fillText(item.meta, itemX + textOffset, metaY);
            }
        });

        ctx.restore();

        if (scrollable) {
            const scrollTrackX = menuX + menuWidth - 12;
            const scrollTrackY = menuY + 14;
            const scrollTrackHeight = menuContentHeight - 12;
            const scrollThumbHeight = Math.max(30, (maxVisibleHeight / totalContentHeight) * scrollTrackHeight);
            const scrollThumbY = scrollTrackY + (scrollOffset / maxScroll) * (scrollTrackHeight - scrollThumbHeight);

            ctx.save();
            ctx.fillStyle = "rgba(80, 80, 80, 0.5)";
            ctx.beginPath();
            ctx.roundRect(scrollTrackX, scrollTrackY, 5, scrollTrackHeight, 2.5);
            ctx.fill();

            ctx.fillStyle = hexToRgba(COLORS.accent, 0.8);
            ctx.beginPath();
            ctx.roundRect(scrollTrackX, scrollThumbY, 5, scrollThumbHeight, 2.5);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    function formatDurationMs(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const parts = [];
        if (hrs > 0) parts.push(`${hrs}hr`);
        if (hrs > 0 || mins > 0) parts.push(`${mins}m`);
        parts.push(`${secs}s`);
        return parts.join(" ");
    }

    function getCropStatus(crop) {
        if (!crop) return null;
        if (!crop.placed || crop.placed <= 0) return null;
        const plantedAt = Number.isFinite(crop.lastPlantedAt) ? crop.lastPlantedAt : null;
        if (!plantedAt || plantedAt <= 0) return { count: crop.placed, harvestText: "Ready" };
        const growMs = Number.isFinite(crop.growTimeMs) ? crop.growTimeMs : Number.isFinite(crop.growMinutes) ? crop.growMinutes * 60 * 1000 : null;
        if (!growMs || growMs <= 0) return { count: crop.placed, harvestText: "Ready" };
        const nowMs = Date.now();
        const remainingMs = Math.max(0, growMs - (nowMs - plantedAt));
        if (remainingMs <= 0) return { count: crop.placed, harvestText: "Ready" };
        return { count: crop.placed, harvestText: formatDurationMs(remainingMs) };
    }

    function getMenuItems(dropdown) {
        if (dropdown.id === "cropSelect") {
            const cropKeys = Object.keys(crops);
            return Object.values(crops).map((crop, index) => {
                const status = getCropStatus(crop);
                let meta = `$${formatCurrency(crop.baseValue)} - ${formatGrowTime(crop.growMinutes)}`;
                if (status) {
                    meta = `Planted: ${status.count} | ${status.harvestText}`;
                }

                const allPreviousUnlocked = index === 0 || cropKeys.slice(0, index).every(key => crops[key].unlocked);
                const canUnlock = allPreviousUnlocked && state.totalMoney >= (crop.unlockCost || 0);

                return {
                    id: crop.id,
                    label: crop.name,
                    meta,
                    locked: !crop.unlocked,
                    unlockCost: crop.unlockCost || 0,
                    canAfford: canUnlock,
                    imageUrl: `images/crops/${crop.id}/${crop.id}-phase-4.png`,
                    requiresPrevious: !allPreviousUnlocked,
                };
            });
        }

        if (dropdown.id === "sizeSelect") {
            return Object.values(sizes).map((size) => ({
                id: size.id,
                label: size.name,
                meta: "",
                locked: !size.unlocked,
                unlockCost: size.unlockCost || 0,
                canAfford: state.totalMoney >= (size.unlockCost || 0),
                iconType: "grid",
                gridSize: size.size,
            }));
        }

        if (dropdown.id === "harvestSizeSelect") {
            return Object.values(sizes).map((size) => ({
                id: size.id,
                label: size.name,
                meta: "",
                locked: !size.unlocked,
                unlockCost: size.unlockCost || 0,
                canAfford: state.totalMoney >= (size.unlockCost || 0),
                iconType: "grid",
                gridSize: size.size,
            }));
        }

        if (dropdown.id === "landscapeSelect") {
            const items = [{
                id: "sell",
                label: "Destroy",
                meta: "Remove landscape",
                locked: false,
                unlockCost: 0,
                canAfford: true,
                imageUrl: null,
                iconType: "trash",
            }];
            Object.values(landscapes).forEach((l) => {
                const cost = l.isFarmland && state.farmlandPlaced < 4 ? 0 : l.cost || 0;
                items.push({
                    id: l.id,
                    label: l.name,
                    meta: cost === 0 ? "Free" : `$${formatCurrency(cost)}`,
                    locked: false,
                    unlockCost: 0,
                    canAfford: true,
                    imageUrl: l.image || null,
                    colorData: l.lowColor || null,
                });
            });
            return items;
        }

        if (dropdown.id === "buildSelect") {
            const items = [{
                id: "sell",
                label: "Sell",
                meta: "Remove and refund",
                locked: false,
                unlockCost: 0,
                canAfford: true,
                imageUrl: null,
                iconType: "dollar",
            }];
            Object.values(buildings || {}).forEach((b) => {
                items.push({
                    id: b.id,
                    label: b.name,
                    meta: `${b.width}x${b.height} | $${formatCurrency(b.cost || 0)}`,
                    locked: false,
                    unlockCost: 0,
                    canAfford: true,
                    imageUrl: b.image || null,
                });
            });
            return items;
        }

        return [];
    }

    function isItemSelected(dropdown, item) {
        if (dropdown.id === "cropSelect") return item.id === state.selectedCropKey;
        if (dropdown.id === "sizeSelect" || dropdown.id === "harvestSizeSelect") return item.id === state.selectedSizeKey;
        if (dropdown.id === "landscapeSelect") return item.id === state.selectedLandscapeKey;
        if (dropdown.id === "buildSelect") return item.id === state.selectedBuildKey;
        return false;
    }

    function formatGrowTime(minutes) {
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
    }

    function render() {
        const computed = computeLayout();

        drawToolbar();

        computed.modeButtons.forEach((btn) => {
            const isActive = btn.mode === state.activeMode;
            const isHover = hudState.hoverElement?.id === btn.id;
            const isPressed = hudState.pointerDown && hudState.pointerDownElement?.id === btn.id;
            drawButton(btn, isActive, isHover, isPressed);
        });

        computed.dropdowns.forEach((dropdown) => {
            const isOpen = hudState.openMenuKey === dropdown.menu;
            const isHover = hudState.hoverElement?.id === dropdown.id;
            drawDropdown(dropdown, isOpen, isHover);
        });

        drawMoneyDisplay(computed.moneyDisplay);
        drawMoneyChange(computed.moneyChange);

        const openDropdown = computed.dropdowns.find((d) => hudState.openMenuKey === d.menu);
        if (openDropdown) {
            drawMenu(openDropdown);
        }
    }

    function updateMoneyChangeAnimation() {
        if (hudState.moneyChangeOpacity <= 0) return false;

        const elapsed = performance.now() - hudState.moneyChangeStart;
        const visibleDuration = 2000;
        const fadeDuration = 300;

        if (elapsed < visibleDuration) {
            hudState.moneyChangeOpacity = 1;
        } else if (elapsed < visibleDuration + fadeDuration) {
            hudState.moneyChangeOpacity = 1 - (elapsed - visibleDuration) / fadeDuration;
        } else {
            hudState.moneyChangeOpacity = 0;
        }

        return hudState.moneyChangeOpacity > 0;
    }

    function showMoneyChange(amount) {
        if (amount === 0) return;
        hudState.moneyChangeAmount = amount;
        hudState.moneyChangeOpacity = 1;
        hudState.moneyChangeStart = performance.now();
        state.needsRender = true;
    }

    function getMenuBounds(dropdown) {
        const items = getMenuItems(dropdown);
        const layout = hudState.layout?.layout || getLayout();
        const itemHeight = 44;
        const maxVisibleHeight = 280;
        const totalContentHeight = items.length * itemHeight;
        const menuContentHeight = Math.min(totalContentHeight, maxVisibleHeight);
        const menuHeight = menuContentHeight + 16;
        const menuWidth = measureMenuWidth(items, layout);

        // Ensure menu doesn't go off screen horizontally (same as drawMenu)
        const padding = layout.padding || 12;
        let menuX = dropdown.x;
        const canvasWidth = canvas.clientWidth;

        // Clamp menu position to stay on screen
        if (menuX + menuWidth > canvasWidth - padding) {
            menuX = canvasWidth - menuWidth - padding;
        }
        if (menuX < padding) {
            menuX = padding;
        }

        const menuY = dropdown.y - menuHeight - 8;
        const scrollable = totalContentHeight > maxVisibleHeight;
        const maxScroll = scrollable ? totalContentHeight - maxVisibleHeight : 0;
        return { menuX, menuY, menuWidth, menuHeight, menuContentHeight, itemHeight, items, maxScroll, scrollable };
    }

    function hitTest(x, y) {
        const computed = hudState.layout;
        if (!computed) return null;

        if (hudState.openMenuKey) {
            const dropdown = computed.dropdowns.find((d) => d.menu === hudState.openMenuKey);
            if (dropdown) {
                const bounds = getMenuBounds(dropdown);
                const { menuX, menuY, menuWidth, menuHeight, menuContentHeight, itemHeight, items, maxScroll } = bounds;
                const scrollOffset = Math.max(0, Math.min(hudState.menuScrollOffset, maxScroll));

                if (x >= menuX && x <= menuX + menuWidth && y >= menuY && y <= menuY + menuHeight) {
                    const relY = y - menuY - 8 + scrollOffset;
                    const itemIndex = Math.floor(relY / itemHeight);
                    if (itemIndex >= 0 && itemIndex < items.length) {
                        const itemYBase = menuY + 8 + itemIndex * itemHeight - scrollOffset;
                        if (itemYBase >= menuY + 8 - itemHeight && itemYBase < menuY + 8 + menuContentHeight) {
                            return { type: "menuItem", id: `menuItem_${dropdown.id}_${itemIndex}`, dropdown, itemIndex, item: items[itemIndex] };
                        }
                    }
                    return { type: "menu", id: "menu" };
                }
            }
        }

        for (const dd of computed.dropdowns) {
            if (x >= dd.x && x <= dd.x + dd.width && y >= dd.y && y <= dd.y + dd.height) {
                return { type: "dropdown", ...dd };
            }
        }

        for (const btn of computed.modeButtons) {
            if (x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height) {
                return { type: "modeButton", ...btn };
            }
        }

        const md = computed.moneyDisplay;
        if (x >= md.x && x <= md.x + md.width && y >= md.y && y <= md.y + md.height) {
            return { type: "moneyDisplay", ...md };
        }

        return null;
    }

    function handlePointerDown(x, y) {
        const hit = hitTest(x, y);
        hudState.pointerDown = true;
        hudState.pointerDownElement = hit;

        if (hit && (hit.type === "menu" || hit.type === "menuItem") && hudState.openMenuKey) {
            hudState.menuDragStart = y;
            hudState.menuDragScrollStart = hudState.menuScrollOffset;
        } else {
            hudState.menuDragStart = null;
        }

        if (hit) {
            state.needsRender = true;
        }
        return !!hit;
    }

    function handlePointerMove(x, y) {
        const hit = hitTest(x, y);
        const prev = hudState.hoverElement?.id;
        hudState.hoverElement = hit;

        if (hudState.menuDragStart !== null && hudState.pointerDown) {
            const deltaY = hudState.menuDragStart - y;
            const computed = hudState.layout;
            if (computed && hudState.openMenuKey) {
                const dropdown = computed.dropdowns.find((d) => d.menu === hudState.openMenuKey);
                if (dropdown) {
                    const bounds = getMenuBounds(dropdown);
                    if (bounds.scrollable) {
                        hudState.menuScrollOffset = Math.max(0, Math.min(bounds.maxScroll, hudState.menuDragScrollStart + deltaY));
                        state.needsRender = true;
                    }
                }
            }
        }

        if (hit?.id !== prev) {
            state.needsRender = true;
        }
    }

    function handlePointerUp(x, y) {
        const hit = hitTest(x, y);
        const wasDown = hudState.pointerDownElement;
        const wasDragging = hudState.menuDragStart !== null && Math.abs(hudState.menuScrollOffset - hudState.menuDragScrollStart) > 5;

        hudState.pointerDown = false;
        hudState.pointerDownElement = null;
        hudState.menuDragStart = null;

        if (wasDragging) {
            return !!hit;
        }

        if (!hit || !wasDown || hit.id !== wasDown.id) {
            if (hudState.openMenuKey && !hit) {
                hudState.openMenuKey = null;
                state.needsRender = true;
            }
            return !!hit;
        }

        if (hit.type === "modeButton") {
            handleModeButtonClick(hit.mode);
            return true;
        }

        if (hit.type === "dropdown") {
            handleDropdownClick(hit);
            return true;
        }

        if (hit.type === "menuItem") {
            handleMenuItemClick(hit.dropdown, hit.item);
            return true;
        }

        return !!hit;
    }

    function handleModeButtonClick(mode) {
        if (mode === "trade") {
            const tradeModal = document.getElementById("tradeModal");
            if (tradeModal) {
                tradeModal.classList.remove("hidden");
                document.body.classList.add("overflow-hidden");
            }
            return;
        }

        if (mode === state.activeMode) return;

        state.activeMode = mode;
        hudState.openMenuKey = null;
        state.needsRender = true;
        saveState();
    }

    function handleDropdownClick(dropdown) {
        if (hudState.openMenuKey === dropdown.menu) {
            hudState.openMenuKey = null;
        } else {
            hudState.openMenuKey = dropdown.menu;
            hudState.menuScrollOffset = 0;
        }
        state.needsRender = true;
    }

    function handleMenuScroll(deltaY) {
        if (!hudState.openMenuKey) return false;
        const computed = hudState.layout;
        if (!computed) return false;
        const dropdown = computed.dropdowns.find((d) => d.menu === hudState.openMenuKey);
        if (!dropdown) return false;

        const bounds = getMenuBounds(dropdown);
        if (!bounds.scrollable) return false;

        hudState.menuScrollOffset = Math.max(0, Math.min(bounds.maxScroll, hudState.menuScrollOffset + deltaY));
        state.needsRender = true;
        return true;
    }

    function handleMenuItemClick(dropdown, item) {
        if (item.locked && item.unlockCost > 0) {
            if (item.canAfford) {
                openConfirmModal(
                    `Unlock ${item.label} for ${formatCurrency(item.unlockCost)}?`,
                    () => {
                        state.totalMoney -= item.unlockCost;
                        unlockItem(dropdown.id, item.id);
                        selectItem(dropdown.id, item.id);
                        onMoneyChanged();
                        state.needsRender = true;
                        saveState();
                    },
                    "Confirm Unlock"
                );
            }
            hudState.openMenuKey = null;
            state.needsRender = true;
            return;
        }

        selectItem(dropdown.id, item.id);
        hudState.openMenuKey = null;
        state.needsRender = true;
        saveState();
    }

    function unlockItem(dropdownId, itemId) {
        if (dropdownId === "cropSelect") {
            if (crops[itemId]) crops[itemId].unlocked = true;
        } else if (dropdownId === "sizeSelect" || dropdownId === "harvestSizeSelect") {
            if (sizes[itemId]) sizes[itemId].unlocked = true;
        }
    }

    function selectItem(dropdownId, itemId) {
        if (dropdownId === "cropSelect") {
            state.selectedCropKey = itemId;
            state.previousCropKey = itemId;
        } else if (dropdownId === "sizeSelect" || dropdownId === "harvestSizeSelect") {
            state.selectedSizeKey = itemId;
        } else if (dropdownId === "landscapeSelect") {
            state.selectedLandscapeKey = itemId;
        } else if (dropdownId === "buildSelect") {
            state.selectedBuildKey = itemId;
        }
    }

    function isPointerOverHud(x, y) {
        return hitTest(x, y) !== null;
    }

    function closeAllMenus() {
        if (hudState.openMenuKey) {
            hudState.openMenuKey = null;
            state.needsRender = true;
        }
    }

    return {
        render,
        hitTest,
        handlePointerMove,
        handlePointerDown,
        handlePointerUp,
        isPointerOverHud,
        showMoneyChange,
        updateMoneyChangeAnimation,
        closeAllMenus,
        computeLayout,
        handleMenuScroll,
    };
}
