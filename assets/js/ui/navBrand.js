const BRAND_STATE_FULL = "full";
const BRAND_STATE_SHORT = "short";
const BRAND_STATE_HIDDEN = "hidden";
const SAFE_BUFFER_PX = 12; // trigger early so the name pill never overlaps the brand

export function createNavBrand({ dom }) {
  const container = dom?.navBar;
  const brand = dom?.navBrand;
  const fullLabel = dom?.navBrandFull;
  const shortLabel = dom?.navBrandShort;
  const icon = dom?.navBrandIcon;
  const actions = dom?.navActions;
  const userBadge = dom?.userBadge;

  if (!container || !brand || !fullLabel || !shortLabel || !icon) {
    return { refresh: () => {} };
  }

  const applyState = (state) => {
    const isHidden = state === BRAND_STATE_HIDDEN;
    brand.classList.toggle("hidden", isHidden);
    fullLabel.classList.toggle("hidden", state !== BRAND_STATE_FULL);
    shortLabel.classList.toggle("hidden", state !== BRAND_STATE_SHORT);
    icon.classList.toggle("hidden", isHidden);
  };

  const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const containerPadding = () => {
    const style = getComputedStyle(container);
    const gap = toNumber(style.columnGap || style.gap) || 12;
    const paddingLeft = toNumber(style.paddingLeft);
    const paddingRight = toNumber(style.paddingRight);
    return { gap, paddingLeft, paddingRight };
  };

  const fits = () => {
    const { gap, paddingLeft, paddingRight } = containerPadding();
    const brandVisible = !brand.classList.contains("hidden");
    const brandWidth = brandVisible ? brand.getBoundingClientRect().width : 0;
    const actionsWidth = actions ? actions.getBoundingClientRect().width : 0;
    const gapWidth = brandVisible && actions ? gap : 0;
    const totalNeeded = paddingLeft + paddingRight + brandWidth + actionsWidth + gapWidth + SAFE_BUFFER_PX;
    return totalNeeded <= container.clientWidth + 0.5;
  };

  const refresh = () => {
    if (userBadge) userBadge.classList.remove("hidden");
    applyState(BRAND_STATE_FULL);
    if (fits()) return;
    applyState(BRAND_STATE_SHORT);
    if (fits()) return;
    if (userBadge) userBadge.classList.add("hidden");
    if (fits()) return;
  };

  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => refresh());
    [container, actions].forEach((el) => el && resizeObserver.observe(el));
  }

  const onWindowResize = () => refresh();
  window.addEventListener("resize", onWindowResize);

  refresh();

  return {
    refresh,
    destroy: () => {
      window.removeEventListener("resize", onWindowResize);
      resizeObserver?.disconnect();
    },
  };
}
