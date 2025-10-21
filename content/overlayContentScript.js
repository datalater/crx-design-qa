const Z_INDEX_MAX = 2147483647;

(function main() {
  installMessageListener();
  installKeyboardShortcuts();
})();

function installMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;
    if (message.type === window.__overlayCompare?.MessageType?.INSERT_OVERLAY) {
      const imageDataUrl = message.payload && message.payload.imageDataUrl;
      const properties = message.payload && message.payload.properties;
      mountOverlayIfNeeded();
      setOverlayImageSource(imageDataUrl);
      updateOverlayProperties(properties);
      revealOverlay();
      reportOverlayState();
    }
    if (message.type === window.__overlayCompare?.MessageType?.UPDATE_OVERLAY) {
      const properties = message.payload && message.payload.properties;
      mountOverlayIfNeeded();
      updateOverlayProperties(properties);
      reportOverlayState();
    }
    if (
      message.type ===
      window.__overlayCompare?.MessageType?.FIT_OVERLAY_TO_VIEWPORT_WIDTH
    ) {
      fitOverlayToViewportWidth();
      reportOverlayState();
    }
    if (
      message.type ===
      window.__overlayCompare?.MessageType?.APPLY_GLOBAL_OUTLINE
    ) {
      applyGlobalOutlineToDocumentAndShadows();
    }
    if (
      message.type ===
      window.__overlayCompare?.MessageType?.REMOVE_GLOBAL_OUTLINE
    ) {
      removeGlobalOutlineFromDocumentAndShadows();
    }
    if (message.type === window.__overlayCompare?.MessageType?.REMOVE_OVERLAY) {
      removeOverlayIfPresent();
    }
    if (
      message.type ===
      window.__overlayCompare?.MessageType?.REQUEST_OVERLAY_STATE
    ) {
      reportOverlayState();
    }
    if (
      message.type === window.__overlayCompare?.MessageType?.GET_VIEWPORT_INFO
    ) {
      reportViewportInfo();
    }
    if (
      message.type ===
      window.__overlayCompare?.MessageType?.START_SPACING_INSPECTOR
    ) {
      startSpacingInspector();
    }
    if (
      message.type ===
      window.__overlayCompare?.MessageType?.STOP_SPACING_INSPECTOR
    ) {
      stopSpacingInspector();
    }
  });
}

function fitOverlayToViewportWidth() {
  const container = document.getElementById(OverlayDomIds.container);
  const image = document.getElementById(OverlayDomIds.image);
  if (!container || !image) return;
  const viewportWidth = Math.max(
    0,
    window.innerWidth ||
      document.documentElement.clientWidth ||
      overlayState.width ||
      0
  );
  if (!viewportWidth) return;
  updateOverlayProperties({ width: viewportWidth });
}

function installKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (!isOverlayMounted()) return;
    const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
    if (!isDeleteKey) return;
    const isTypingInEditable = isEventTargetEditable(event);
    if (isTypingInEditable) return;
    removeOverlayIfPresent();
    event.preventDefault();
  });
}

function isOverlayMounted() {
  return !!document.getElementById(OverlayDomIds.container);
}

function isEventTargetEditable(event) {
  const target = event.target;
  if (!target) return false;
  const tagName = (target.tagName || "").toLowerCase();
  const isInputLike =
    tagName === "input" || tagName === "textarea" || tagName === "select";
  const isContentEditable = !!target.isContentEditable;
  return isInputLike || isContentEditable;
}

const OverlayDomIds = {
  container: "overlayCompare__container",
  image: "overlayCompare__image",
  handleTopLeft: "overlayCompare__handleTopLeft",
  handleTopRight: "overlayCompare__handleTopRight",
  handleBottomLeft: "overlayCompare__handleBottomLeft",
  handleBottomRight: "overlayCompare__handleBottomRight",
};

const OverlayDefaults = {
  minWidth: 20,
  minHeight: 20,
  defaultOpacity: 0.5,
  defaultBlendMode: "normal",
};

// Spacing Inspector color configuration
const InspectorColors = {
  padding: "#C6DFBB",
  margin: "#FACDA1",
  gap: "#9897E2",
  self: "#A3C7E9",
};

// Spacing Inspector opacity configuration
const InspectorOpacity = {
  paddingBg: 0.7,
  marginBg: 0.6,
  borderBg: 0.2,
  contentBg: 0.35,
  contentOutline: 1.0,
  gapHatch: 0.7,
  gapBase: 0.18,
};

function hexToRgba(hex, alpha) {
  const v = hex.replace("#", "");
  const bigint = parseInt(
    v.length === 3
      ? v
          .split("")
          .map((c) => c + c)
          .join("")
      : v,
    16
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

let overlayState = {
  positionX: 0,
  positionY: 0,
  width: 0,
  height: 0,
  aspectRatio: 0,
  opacity: OverlayDefaults.defaultOpacity,
  blendMode: OverlayDefaults.defaultBlendMode,
  imageDataUrl: null,
  isDragging: false,
  isResizing: false,
  activeResizeHandle: null,
  dragStartMouseX: 0,
  dragStartMouseY: 0,
  dragStartPositionX: 0,
  dragStartPositionY: 0,
  dragStartWidth: 0,
  dragStartHeight: 0,
};

function mountOverlayIfNeeded() {
  const existing = document.getElementById(OverlayDomIds.container);
  if (existing) return existing;
  const container = document.createElement("div");
  container.id = OverlayDomIds.container;
  applyOverlayContainerStyle(container);
  const image = document.createElement("img");
  image.id = OverlayDomIds.image;
  applyOverlayImageStyle(image);
  container.appendChild(image);
  const handles = createResizeHandles();
  handles.forEach((handle) => container.appendChild(handle));
  document.documentElement.appendChild(container);
  wireDragAndResize(container, image);
  return container;
}

function removeOverlayIfPresent() {
  const container = document.getElementById(OverlayDomIds.container);
  if (container && container.parentElement) {
    container.parentElement.removeChild(container);
  }
}

function setOverlayImageSource(dataUrl) {
  overlayState.imageDataUrl = dataUrl;
  const image = document.getElementById(OverlayDomIds.image);
  if (!image) return;
  image.src = dataUrl;
  image.onload = () => {
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    overlayState.aspectRatio = naturalHeight ? naturalWidth / naturalHeight : 0;
    if (!overlayState.width || !overlayState.height) {
      const viewportWidth = Math.max(
        0,
        window.innerWidth ||
          document.documentElement.clientWidth ||
          naturalWidth
      );
      const computedHeight =
        overlayState.aspectRatio > 0
          ? Math.round(viewportWidth / overlayState.aspectRatio)
          : naturalHeight;
      updateOverlayProperties({
        positionX: 0,
        positionY: 0,
        width: viewportWidth,
        height: computedHeight,
      });
    }
  };
}

function updateOverlayProperties(newProperties) {
  if (!newProperties) return;
  const container = document.getElementById(OverlayDomIds.container);
  const image = document.getElementById(OverlayDomIds.image);
  if (!container || !image) return;

  const requested = { ...overlayState, ...newProperties };
  const maintainAspectRatio = requested.aspectRatio > 0;

  let nextWidth = Number(requested.width) || 0;
  let nextHeight = Number(requested.height) || 0;

  const widthProvided = Object.prototype.hasOwnProperty.call(
    newProperties,
    "width"
  );
  const heightProvided = Object.prototype.hasOwnProperty.call(
    newProperties,
    "height"
  );

  if (maintainAspectRatio) {
    if (widthProvided && !heightProvided) {
      nextWidth = Math.max(nextWidth, OverlayDefaults.minWidth);
      nextHeight = Math.max(
        Math.round(nextWidth / requested.aspectRatio),
        OverlayDefaults.minHeight
      );
    } else if (!widthProvided && heightProvided) {
      nextHeight = Math.max(nextHeight, OverlayDefaults.minHeight);
      nextWidth = Math.max(
        Math.round(nextHeight * requested.aspectRatio),
        OverlayDefaults.minWidth
      );
    } else if (widthProvided && heightProvided) {
      nextWidth = Math.max(nextWidth, OverlayDefaults.minWidth);
      nextHeight = Math.max(
        Math.round(nextWidth / requested.aspectRatio),
        OverlayDefaults.minHeight
      );
    } else {
      nextWidth = Math.max(nextWidth, OverlayDefaults.minWidth);
      nextHeight = Math.max(
        Math.round(nextWidth / requested.aspectRatio),
        OverlayDefaults.minHeight
      );
    }
  } else {
    nextWidth = Math.max(nextWidth, OverlayDefaults.minWidth);
    nextHeight = Math.max(nextHeight, OverlayDefaults.minHeight);
  }

  overlayState = { ...requested, width: nextWidth, height: nextHeight };
  applyOverlayLayout(container, image);
}

function applyOverlayLayout(container, image) {
  container.style.left = `${overlayState.positionX}px`;
  container.style.top = `${overlayState.positionY}px`;
  container.style.width = `${overlayState.width}px`;
  container.style.height = `${overlayState.height}px`;
  image.style.width = `100%`;
  image.style.height = `100%`;
  image.style.opacity = String(overlayState.opacity);
  image.style.mixBlendMode = overlayState.blendMode || "normal";
}

function applyOverlayContainerStyle(container) {
  container.style.position = "fixed";
  container.style.left = "0px";
  container.style.top = "0px";
  container.style.width = "0px";
  container.style.height = "0px";
  container.style.zIndex = String(Z_INDEX_MAX);
  container.style.pointerEvents = "auto";
  container.style.boxSizing = "border-box";
  container.style.border = "1px dashed rgba(0,0,0,0.3)";
}

function applyOverlayImageStyle(image) {
  image.style.display = "block";
  image.style.userSelect = "none";
  image.style.pointerEvents = "none";
}

function createResizeHandles() {
  const handleTopLeft = document.createElement("div");
  const handleTopRight = document.createElement("div");
  const handleBottomLeft = document.createElement("div");
  const handleBottomRight = document.createElement("div");
  handleTopLeft.id = OverlayDomIds.handleTopLeft;
  handleTopRight.id = OverlayDomIds.handleTopRight;
  handleBottomLeft.id = OverlayDomIds.handleBottomLeft;
  handleBottomRight.id = OverlayDomIds.handleBottomRight;
  [handleTopLeft, handleTopRight, handleBottomLeft, handleBottomRight].forEach(
    (h) => applyHandleStyle(h)
  );
  handleTopLeft.style.left = "-6px";
  handleTopLeft.style.top = "-6px";
  handleTopLeft.dataset.resizeHandle = "topLeft";
  handleTopRight.style.right = "-6px";
  handleTopRight.style.top = "-6px";
  handleTopRight.dataset.resizeHandle = "topRight";
  handleBottomLeft.style.left = "-6px";
  handleBottomLeft.style.bottom = "-6px";
  handleBottomLeft.dataset.resizeHandle = "bottomLeft";
  handleBottomRight.style.right = "-6px";
  handleBottomRight.style.bottom = "-6px";
  handleBottomRight.dataset.resizeHandle = "bottomRight";
  return [handleTopLeft, handleTopRight, handleBottomLeft, handleBottomRight];
}

function applyHandleStyle(handle) {
  handle.style.position = "absolute";
  handle.style.width = "12px";
  handle.style.height = "12px";
  handle.style.background = "#5b8def";
  handle.style.border = "2px solid white";
  handle.style.borderRadius = "50%";
  handle.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
  handle.style.cursor = "nwse-resize";
}

function wireDragAndResize(container, image) {
  container.addEventListener("mousedown", onPointerDown);
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("mouseup", onPointerUp);

  function onPointerDown(event) {
    const target = event.target;
    const isHandle = target && target.dataset && target.dataset.resizeHandle;
    if (isHandle) {
      startResizing(target.dataset.resizeHandle, event);
      return;
    }
    const isInsideContainer = target === container || target === image;
    if (isInsideContainer) {
      startDragging(event);
    }
  }

  function onPointerMove(event) {
    if (overlayState.isDragging) {
      continueDragging(event);
      return;
    }
    if (overlayState.isResizing) {
      continueResizing(event);
      return;
    }
  }

  function onPointerUp() {
    if (overlayState.isDragging || overlayState.isResizing) {
      overlayState.isDragging = false;
      overlayState.isResizing = false;
      overlayState.activeResizeHandle = null;
      reportOverlayState();
    }
  }
}

function startDragging(event) {
  overlayState.isDragging = true;
  overlayState.dragStartMouseX = event.clientX;
  overlayState.dragStartMouseY = event.clientY;
  overlayState.dragStartPositionX = overlayState.positionX;
  overlayState.dragStartPositionY = overlayState.positionY;
}

function continueDragging(event) {
  const deltaX = event.clientX - overlayState.dragStartMouseX;
  const deltaY = event.clientY - overlayState.dragStartMouseY;
  const nextX = overlayState.dragStartPositionX + deltaX;
  const nextY = overlayState.dragStartPositionY + deltaY;
  updateOverlayProperties({ positionX: nextX, positionY: nextY });
}

function startResizing(handleName, event) {
  overlayState.isResizing = true;
  overlayState.activeResizeHandle = handleName;
  overlayState.dragStartMouseX = event.clientX;
  overlayState.dragStartMouseY = event.clientY;
  overlayState.dragStartPositionX = overlayState.positionX;
  overlayState.dragStartPositionY = overlayState.positionY;
  overlayState.dragStartWidth = overlayState.width;
  overlayState.dragStartHeight = overlayState.height;
}

function continueResizing(event) {
  const handle = overlayState.activeResizeHandle;
  const aspectRatio =
    overlayState.aspectRatio > 0 ? overlayState.aspectRatio : 0;
  const anchor = getResizeAnchorForHandle(handle, overlayState);
  const currentMouseX = event.clientX;
  const currentMouseY = event.clientY;
  if (!anchor) return;

  const dx = currentMouseX - anchor.anchorX;
  const dy = currentMouseY - anchor.anchorY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let targetWidth = absDx;
  let targetHeight = absDy;

  if (aspectRatio > 0) {
    const heightFromWidth = targetWidth / aspectRatio;
    const widthFromHeight = targetHeight * aspectRatio;
    if (heightFromWidth <= targetHeight) {
      targetHeight = heightFromWidth;
    } else {
      targetWidth = widthFromHeight;
    }
  }

  targetWidth = Math.max(targetWidth, OverlayDefaults.minWidth);
  targetHeight = Math.max(targetHeight, OverlayDefaults.minHeight);

  let nextX = anchor.anchorX;
  let nextY = anchor.anchorY;
  if (handle === "topLeft") {
    nextX = anchor.anchorX - targetWidth;
    nextY = anchor.anchorY - targetHeight;
  } else if (handle === "topRight") {
    nextX = anchor.anchorX;
    nextY = anchor.anchorY - targetHeight;
  } else if (handle === "bottomLeft") {
    nextX = anchor.anchorX - targetWidth;
    nextY = anchor.anchorY;
  } else if (handle === "bottomRight") {
    nextX = anchor.anchorX;
    nextY = anchor.anchorY;
  }

  updateOverlayProperties({
    positionX: nextX,
    positionY: nextY,
    width: Math.round(targetWidth),
    height: Math.round(targetHeight),
  });
}

function getResizeAnchorForHandle(handle, state) {
  if (!handle) return null;
  const startX = state.dragStartPositionX;
  const startY = state.dragStartPositionY;
  const startW = state.dragStartWidth;
  const startH = state.dragStartHeight;
  if (handle === "topLeft") {
    return { anchorX: startX + startW, anchorY: startY + startH };
  }
  if (handle === "topRight") {
    return { anchorX: startX, anchorY: startY + startH };
  }
  if (handle === "bottomLeft") {
    return { anchorX: startX + startW, anchorY: startY };
  }
  if (handle === "bottomRight") {
    return { anchorX: startX, anchorY: startY };
  }
  return null;
}

function revealOverlay() {
  const container = document.getElementById(OverlayDomIds.container);
  if (!container) return;
  container.style.display = "block";
}

function reportOverlayState() {
  const overlayStateForReport = {
    positionX: overlayState.positionX,
    positionY: overlayState.positionY,
    width: overlayState.width,
    height: overlayState.height,
    opacity: overlayState.opacity,
    blendMode: overlayState.blendMode,
  };
  chrome.runtime.sendMessage({
    type: window.__overlayCompare?.MessageType?.REPORT_OVERLAY_STATE,
    payload: { overlayState: overlayStateForReport },
  });
}

function reportViewportInfo() {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const height =
    window.innerHeight || document.documentElement.clientHeight || 0;
  const dpr = window.devicePixelRatio || 1;
  chrome.runtime.sendMessage({
    type: window.__overlayCompare?.MessageType?.REPORT_VIEWPORT_INFO,
    payload: { viewport: { width, height, devicePixelRatio: dpr } },
  });
}

const OutlineStyleConfig = {
  styleElementId: "overlayCompare__outlineStyle",
  cssText:
    "*, *::before, *::after { outline: 0.1px solid color-mix(in srgb, currentColor 70%, white 70%); }",
};

function applyGlobalOutlineToDocumentAndShadows() {
  injectOutlineStyleIntoRoot(document);
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT
  );
  let node;
  while ((node = walker.nextNode())) {
    if (node.shadowRoot) injectOutlineStyleIntoRoot(node.shadowRoot);
  }
}

function removeGlobalOutlineFromDocumentAndShadows() {
  removeOutlineStyleFromRoot(document);
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT
  );
  let node;
  while ((node = walker.nextNode())) {
    if (node.shadowRoot) removeOutlineStyleFromRoot(node.shadowRoot);
  }
}

function injectOutlineStyleIntoRoot(root) {
  if (!root || !root.getElementById) return;
  if (root.getElementById(OutlineStyleConfig.styleElementId)) return;
  const style = document.createElement("style");
  style.id = OutlineStyleConfig.styleElementId;
  style.textContent = OutlineStyleConfig.cssText;
  const parent = root.head || root;
  parent.appendChild(style);
}

function removeOutlineStyleFromRoot(root) {
  if (!root || !root.getElementById) return;
  const existing = root.getElementById(OutlineStyleConfig.styleElementId);
  if (existing && existing.parentNode)
    existing.parentNode.removeChild(existing);
}

const SpacingInspectorIds = {
  container: "overlayCompare__spacingInspector",
  layerMargin: "overlayCompare__spacingMargin",
  layerBorder: "overlayCompare__spacingBorder",
  layerPadding: "overlayCompare__spacingPadding",
  layerContent: "overlayCompare__spacingContent",
  tooltip: "overlayCompare__spacingTooltip",
};

let spacingInspectorState = {
  active: false,
  locked: false,
  currentElement: null,
  targetElement: null,
  lastMouseX: 0,
  lastMouseY: 0,
};

function startSpacingInspector() {
  if (spacingInspectorState.active) return;
  spacingInspectorState.active = true;
  spacingInspectorState.locked = false;
  spacingInspectorState.currentElement = null;
  spacingInspectorState.targetElement = null;
  spacingInspectorState.lastMouseX = 0;
  spacingInspectorState.lastMouseY = 0;
  ensureSpacingInspectorOverlay();
  document.addEventListener("mousemove", onInspectorMouseMove, true);
  document.addEventListener("click", onInspectorClick, true);
  document.addEventListener("mousedown", stopEvent, true);
  document.addEventListener("mouseup", stopEvent, true);
  document.addEventListener("keydown", onInspectorKeyDown, true);
}

function stopSpacingInspector() {
  if (!spacingInspectorState.active) return;
  spacingInspectorState.active = false;
  spacingInspectorState.locked = false;
  spacingInspectorState.currentElement = null;
  spacingInspectorState.targetElement = null;
  spacingInspectorState.lastMouseX = 0;
  spacingInspectorState.lastMouseY = 0;
  removeSpacingInspectorOverlay();
  document.removeEventListener("mousemove", onInspectorMouseMove, true);
  document.removeEventListener("click", onInspectorClick, true);
  document.removeEventListener("mousedown", stopEvent, true);
  document.removeEventListener("mouseup", stopEvent, true);
  document.removeEventListener("keydown", onInspectorKeyDown, true);
}

function onInspectorMouseMove(event) {
  if (!spacingInspectorState.active) return;
  spacingInspectorState.lastMouseX = event.clientX;
  spacingInspectorState.lastMouseY = event.clientY;
  const hovered = event.target instanceof Element ? event.target : null;
  if (!hovered) return;
  spacingInspectorState.currentElement = hovered;
  if (spacingInspectorState.locked && spacingInspectorState.targetElement) {
    renderPairDistance(spacingInspectorState.targetElement, hovered);
  } else {
    renderSpacingForElement(hovered);
  }
  stopEvent(event);
}

function onInspectorClick(event) {
  if (!spacingInspectorState.active) return;
  const el = event.target instanceof Element ? event.target : null;
  if (!el) return;
  spacingInspectorState.lastMouseX = event.clientX;
  spacingInspectorState.lastMouseY = event.clientY;
  spacingInspectorState.currentElement = el;
  spacingInspectorState.targetElement = el;
  spacingInspectorState.locked = true;
  // On lock, keep target highlighted but wait for hover of other elements to show pair distances
  renderSpacingForElement(el);
  stopEvent(event);
}

function onInspectorKeyDown(event) {
  if (event.key === "Escape") {
    stopSpacingInspector();
    stopEvent(event);
  }
  if (event.key === "Enter") {
    spacingInspectorState.locked = !spacingInspectorState.locked;
    stopEvent(event);
  }
}

function stopEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

function ensureSpacingInspectorOverlay() {
  let container = document.getElementById(SpacingInspectorIds.container);
  if (container) return container;
  container = document.createElement("div");
  container.id = SpacingInspectorIds.container;
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.zIndex = String(Z_INDEX_MAX);
  container.style.pointerEvents = "none";
  document.documentElement.appendChild(container);

  const layerMargin = document.createElement("div");
  layerMargin.id = SpacingInspectorIds.layerMargin;
  applyLayerBaseStyle(
    layerMargin,
    hexToRgba(InspectorColors.margin, InspectorOpacity.marginBg)
  );
  const layerBorder = document.createElement("div");
  layerBorder.id = SpacingInspectorIds.layerBorder;
  applyLayerBaseStyle(
    layerBorder,
    hexToRgba(InspectorColors.self, InspectorOpacity.borderBg)
  );
  const layerPadding = document.createElement("div");
  layerPadding.id = SpacingInspectorIds.layerPadding;
  applyLayerBaseStyle(
    layerPadding,
    hexToRgba(InspectorColors.padding, InspectorOpacity.paddingBg)
  );
  const layerContent = document.createElement("div");
  layerContent.id = SpacingInspectorIds.layerContent;
  applyLayerBaseStyle(
    layerContent,
    hexToRgba(InspectorColors.self, InspectorOpacity.contentBg)
  );
  layerContent.style.outline = `1px solid ${hexToRgba(
    InspectorColors.self,
    InspectorOpacity.contentOutline
  )}`;

  container.appendChild(layerMargin);
  container.appendChild(layerBorder);
  container.appendChild(layerPadding);
  container.appendChild(layerContent);
  const tooltip = document.createElement("div");
  tooltip.id = SpacingInspectorIds.tooltip;
  applyTooltipBaseStyle(tooltip);
  container.appendChild(tooltip);
  // Pair overlays are created dynamically per render
  return container;
}

function removeSpacingInspectorOverlay() {
  const container = document.getElementById(SpacingInspectorIds.container);
  if (container && container.parentElement)
    container.parentElement.removeChild(container);
}

function applyLayerBaseStyle(layer, background) {
  layer.style.position = "fixed";
  layer.style.left = "0";
  layer.style.top = "0";
  layer.style.width = "0";
  layer.style.height = "0";
  layer.style.background = background;
  layer.style.opacity = "0.5";
}

function renderSpacingForElement(element) {
  const container = ensureSpacingInspectorOverlay();
  clearPairArtifacts(container);
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const parent = element.parentElement;
  const parentStyle = parent ? getComputedStyle(parent) : null;
  const parentRect = parent ? parent.getBoundingClientRect() : null;

  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderRight = parseFloat(style.borderRightWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const marginLeft = parseFloat(style.marginLeft) || 0;
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginRight = parseFloat(style.marginRight) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;

  const borderBox = rect;
  const paddingBox = {
    left: rect.left + borderLeft,
    top: rect.top + borderTop,
    right: rect.right - borderRight,
    bottom: rect.bottom - borderBottom,
  };
  const contentBox = {
    left: paddingBox.left + paddingLeft,
    top: paddingBox.top + paddingTop,
    right: paddingBox.right - paddingRight,
    bottom: paddingBox.bottom - paddingBottom,
  };
  const marginBox = {
    left: rect.left - marginLeft,
    top: rect.top - marginTop,
    right: rect.right + marginRight,
    bottom: rect.bottom + marginBottom,
  };

  positionLayer(SpacingInspectorIds.layerMargin, marginBox);
  positionLayer(SpacingInspectorIds.layerBorder, borderBox);
  positionLayer(SpacingInspectorIds.layerPadding, paddingBox);
  positionLayer(SpacingInspectorIds.layerContent, contentBox);

  removeExistingDistanceLabels(container);
  removeGapBands(container);
  // Precise gap shading between adjacent children for flex/grid containers
  addPreciseGapBandsForContainer(element, contentBox, style, container);
  // Note: parent-based gap shading removed to avoid confusion; we now focus on container's own gaps

  updateInspectorTooltipForElement(element);
}

function renderPairDistance(target, hovered) {
  const container = ensureSpacingInspectorOverlay();
  // Hide box model layers by collapsing them
  positionLayer(SpacingInspectorIds.layerMargin, {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  });
  positionLayer(SpacingInspectorIds.layerBorder, {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  });
  positionLayer(SpacingInspectorIds.layerPadding, {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  });
  positionLayer(SpacingInspectorIds.layerContent, {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  });

  clearPairArtifacts(container);
  removeGapBands(container);

  const tr = target.getBoundingClientRect();
  const hr = hovered.getBoundingClientRect();

  // Draw outlines for both boxes
  addOutlineRect(container, tr, "rgba(64, 156, 255, 0.9)");
  addOutlineRect(container, hr, "rgba(255, 64, 129, 0.9)");

  const overlapY = Math.max(
    0,
    Math.min(tr.bottom, hr.bottom) - Math.max(tr.top, hr.top)
  );
  const overlapX = Math.max(
    0,
    Math.min(tr.right, hr.right) - Math.max(tr.left, hr.left)
  );

  // Horizontal distance
  if (hr.left >= tr.right) {
    const dx = Math.round(hr.left - tr.right);
    const y = Math.round(
      (Math.max(tr.top, hr.top) + Math.min(tr.bottom, hr.bottom)) / 2
    );
    addPairLine(container, tr.right, y, hr.left, y, "h", dx);
  } else if (tr.left >= hr.right) {
    const dx = Math.round(tr.left - hr.right);
    const y = Math.round(
      (Math.max(tr.top, hr.top) + Math.min(tr.bottom, hr.bottom)) / 2
    );
    addPairLine(container, hr.right, y, tr.left, y, "h", dx);
  }

  // Vertical distance
  if (hr.top >= tr.bottom) {
    const dy = Math.round(hr.top - tr.bottom);
    const x = Math.round(
      (Math.max(tr.left, hr.left) + Math.min(tr.right, hr.right)) / 2
    );
    addPairLine(container, x, tr.bottom, x, hr.top, "v", dy);
  } else if (tr.top >= hr.bottom) {
    const dy = Math.round(tr.top - hr.bottom);
    const x = Math.round(
      (Math.max(tr.left, hr.left) + Math.min(tr.right, hr.right)) / 2
    );
    addPairLine(container, x, hr.bottom, x, tr.top, "v", dy);
  }

  // If there is no overlap on either axis, draw both lines from nearest corners
  if (overlapX <= 0 && overlapY <= 0) {
    // choose nearest corners
    const cornersT = [
      { x: tr.left, y: tr.top },
      { x: tr.right, y: tr.top },
      { x: tr.left, y: tr.bottom },
      { x: tr.right, y: tr.bottom },
    ];
    const cornersH = [
      { x: hr.left, y: hr.top },
      { x: hr.right, y: hr.top },
      { x: hr.left, y: hr.bottom },
      { x: hr.right, y: hr.bottom },
    ];
    let best = null;
    cornersT.forEach((a) => {
      cornersH.forEach((b) => {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        const d = dx + dy;
        if (!best || d < best.d) best = { a, b, dx, dy };
      });
    });
    if (best) {
      const midY = Math.round((best.a.y + best.b.y) / 2);
      const midX = Math.round((best.a.x + best.b.x) / 2);
      addPairLine(
        container,
        best.a.x,
        midY,
        best.b.x,
        midY,
        "h",
        Math.round(Math.abs(best.a.x - best.b.x))
      );
      addPairLine(
        container,
        midX,
        best.a.y,
        midX,
        best.b.y,
        "v",
        Math.round(Math.abs(best.a.y - best.b.y))
      );
    }
  }

  // Precise gap shading for hovered if it is a container
  const hoveredStyle = getComputedStyle(hovered);
  const hbL = parseFloat(hoveredStyle.borderLeftWidth) || 0;
  const hbT = parseFloat(hoveredStyle.borderTopWidth) || 0;
  const hbR = parseFloat(hoveredStyle.borderRightWidth) || 0;
  const hbB = parseFloat(hoveredStyle.borderBottomWidth) || 0;
  const hpL = parseFloat(hoveredStyle.paddingLeft) || 0;
  const hpT = parseFloat(hoveredStyle.paddingTop) || 0;
  const hpR = parseFloat(hoveredStyle.paddingRight) || 0;
  const hpB = parseFloat(hoveredStyle.paddingBottom) || 0;
  const hoveredContentBox = {
    left: hr.left + hbL + hpL,
    top: hr.top + hbT + hpT,
    right: hr.right - hbR - hpR,
    bottom: hr.bottom - hbB - hpB,
  };
  addPreciseGapBandsForContainer(
    hovered,
    hoveredContentBox,
    hoveredStyle,
    container
  );

  // Show tooltip for hovered with pair info
  const dxInfo = computeHorizontalDistanceInfo(tr, hr);
  const dyInfo = computeVerticalDistanceInfo(tr, hr);
  const pairLines = [];
  if (dxInfo) pairLines.push(`Δx: ${dxInfo.distance}px`);
  if (dyInfo) pairLines.push(`Δy: ${dyInfo.distance}px`);
  updateInspectorTooltipForElement(hovered, pairLines);
}

function addOutlineRect(container, rect, color) {
  const outline = document.createElement("div");
  outline.dataset.overlayPair = "1";
  outline.style.position = "fixed";
  outline.style.left = rect.left + "px";
  outline.style.top = rect.top + "px";
  outline.style.width = Math.max(0, rect.right - rect.left) + "px";
  outline.style.height = Math.max(0, rect.bottom - rect.top) + "px";
  outline.style.border = `1px dashed ${color}`;
  outline.style.background = "transparent";
  outline.style.pointerEvents = "none";
  outline.style.zIndex = String(Z_INDEX_MAX);
  container.appendChild(outline);
}

function addPairLine(container, x1, y1, x2, y2, orientation, value) {
  const line = document.createElement("div");
  line.dataset.overlayPair = "1";
  line.style.position = "fixed";
  line.style.background = "rgba(236, 72, 153, 0.9)"; // pink
  line.style.pointerEvents = "none";
  line.style.zIndex = String(Z_INDEX_MAX);
  if (orientation === "h") {
    const left = Math.min(x1, x2);
    const width = Math.abs(x2 - x1);
    line.style.left = left + "px";
    line.style.top = y1 - 1 + "px";
    line.style.width = width + "px";
    line.style.height = "2px";
  } else {
    const top = Math.min(y1, y2);
    const height = Math.abs(y2 - y1);
    line.style.left = x1 - 1 + "px";
    line.style.top = top + "px";
    line.style.width = "2px";
    line.style.height = height + "px";
  }
  container.appendChild(line);

  if (value !== undefined && value !== null) {
    const label = document.createElement("div");
    label.dataset.overlayPair = "1";
    label.textContent = String(value) + "px";
    label.style.position = "fixed";
    label.style.fontSize = "11px";
    label.style.lineHeight = "1";
    label.style.color = "#ffffff";
    label.style.background = "rgba(3, 7, 18, 0.8)";
    label.style.padding = "2px 4px";
    label.style.borderRadius = "4px";
    label.style.pointerEvents = "none";
    label.style.zIndex = String(Z_INDEX_MAX);
    if (orientation === "h") {
      const left = Math.min(x1, x2);
      const width = Math.abs(x2 - x1);
      label.style.left = left + width / 2 + "px";
      label.style.top = y1 - 6 + "px";
      label.style.transform = "translate(-50%, -100%)";
    } else {
      const top = Math.min(y1, y2);
      const height = Math.abs(y2 - y1);
      label.style.left = x1 + 6 + "px";
      label.style.top = top + height / 2 + "px";
      label.style.transform = "translate(0, -50%)";
    }
    container.appendChild(label);
  }
}

function clearPairArtifacts(container) {
  const nodes = container.querySelectorAll('[data-overlay-pair="1"]');
  nodes.forEach((n) => n.parentElement && n.parentElement.removeChild(n));
}

function applyTooltipBaseStyle(tooltip) {
  tooltip.style.position = "fixed";
  tooltip.style.maxWidth = "320px";
  tooltip.style.fontFamily =
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  tooltip.style.fontSize = "12px";
  tooltip.style.lineHeight = "1.4";
  tooltip.style.color = "#0f172a";
  tooltip.style.background = "#ffffff";
  tooltip.style.boxShadow =
    "0 6px 20px rgba(2, 6, 23, 0.15), 0 2px 6px rgba(2, 6, 23, 0.08)";
  tooltip.style.border = "1px solid rgba(148, 163, 184, 0.35)";
  tooltip.style.borderRadius = "8px";
  tooltip.style.padding = "8px 10px";
  tooltip.style.pointerEvents = "none";
  tooltip.style.zIndex = String(Z_INDEX_MAX);
  tooltip.style.transform = "translate(-50%, -100%)";
  tooltip.style.display = "none";
  tooltip.style.whiteSpace = "normal";
}

function setTooltipTitle(tooltip, selectorText) {
  let title =
    tooltip.firstChild &&
    tooltip.firstChild.dataset &&
    tooltip.firstChild.dataset.overlayTooltipTitle
      ? tooltip.firstChild
      : null;
  if (!title) {
    title = document.createElement("div");
    title.dataset.overlayTooltipTitle = "1";
    tooltip.insertBefore(title, tooltip.firstChild || null);
  }
  title.textContent = selectorText || "";
  title.style.fontFamily =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace";
  title.style.fontSize = "12px";
  title.style.fontWeight = "700";
  title.style.color = "#0f172a";
  title.style.marginBottom = "6px";
}

function updateInspectorTooltipForElement(element, extraLines) {
  const tooltip = document.getElementById(SpacingInspectorIds.tooltip);
  if (!tooltip) return;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const selector = buildReadableSelector(element);
  const sizeText = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  const paddingText = formatBoxValues(
    style.paddingTop,
    style.paddingRight,
    style.paddingBottom,
    style.paddingLeft
  );
  const marginText = formatBoxValues(
    style.marginTop,
    style.marginRight,
    style.marginBottom,
    style.marginLeft
  );
  const display = style.display;
  const isFlex = display.includes("flex");
  const isGrid = display.includes("grid");
  const rowGap = style.rowGap || "0px";
  const columnGap = style.columnGap || "0px";
  const layoutItems = [];
  if (isFlex || isGrid) {
    if (rowGap !== "0px" || columnGap !== "0px") {
      layoutItems.push({
        key: "row-gap",
        value: rowGap,
        color: "rgba(16, 185, 129, 1)",
      });
      layoutItems.push({
        key: "column-gap",
        value: columnGap,
        color: "rgba(168, 85, 247, 1)",
      });
    }
  }

  const groups = [];
  // Title header with selector
  setTooltipTitle(tooltip, selector);
  // Basics section lower priority
  groups.push({
    title: "Basics",
    items: [
      { key: "size", value: sizeText },
      { key: "display", value: display },
    ],
  });
  groups.push({
    title: "Box Model",
    items: [
      { key: "padding", value: paddingText, color: InspectorColors.padding },
      { key: "margin", value: marginText, color: InspectorColors.margin },
    ],
  });
  if (layoutItems.length) {
    // normalize colors to InspectorColors.gap
    const layoutWithColors = layoutItems.map((it) => ({
      key: it.key,
      value: it.value,
      color: InspectorColors.gap,
    }));
    groups.push({ title: "Layout", items: layoutWithColors });
  }
  if (Array.isArray(extraLines) && extraLines.length) {
    groups.push({
      title: "Pair",
      items: extraLines.map((t) => {
        const parts = String(t).split(":");
        return { key: parts[0].trim(), value: parts.slice(1).join(":").trim() };
      }),
    });
  }
  setTooltipGroupsContent(tooltip, groups);
  // Ensure visible for measurement before positioning
  tooltip.style.display = "block";
  positionTooltipNearRect(tooltip, rect, spacingInspectorState);
}

function positionTooltipNearRect(tooltip, rect, state) {
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = 8;
  const w = tooltip.offsetWidth || 240;
  const h = tooltip.offsetHeight || 80;

  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;

  const candidates = [];
  candidates.push({
    x: Math.round(cx),
    y: Math.round(rect.top) - 8,
    t: "translate(-50%,-100%)",
  });
  candidates.push({
    x: Math.round(cx),
    y: Math.round(rect.bottom) + 8,
    t: "translate(-50%,0)",
  });
  candidates.push({
    x: Math.round(rect.right) + 8,
    y: Math.round(cy),
    t: "translate(0,-50%)",
  });
  candidates.push({
    x: Math.round(rect.left) - 8,
    y: Math.round(cy),
    t: "translate(-100%,-50%)",
  });

  const isVeryTall = rect.bottom - rect.top > vh * 0.8;
  const isVeryWide = rect.right - rect.left > vw * 0.8;
  const hasPointer =
    state &&
    typeof state.lastMouseX === "number" &&
    typeof state.lastMouseY === "number" &&
    (state.lastMouseX || state.lastMouseY);
  if ((isVeryTall || isVeryWide) && hasPointer) {
    candidates.unshift({
      x: state.lastMouseX,
      y: state.lastMouseY - 12,
      t: "translate(-50%,-100%)",
    });
    candidates.unshift({
      x: state.lastMouseX,
      y: state.lastMouseY + 12,
      t: "translate(-50%,0)",
    });
  }

  let chosen = null;
  for (const c of candidates) {
    const bounds = predictTooltipBounds(c, w, h);
    if (
      bounds.left >= margin &&
      bounds.top >= margin &&
      bounds.right <= vw - margin &&
      bounds.bottom <= vh - margin
    ) {
      chosen = c;
      break;
    }
  }
  if (!chosen) {
    const x = Math.max(margin + w / 2, Math.min(vw - margin - w / 2, cx));
    const y = Math.max(margin, Math.min(vh - margin - h, rect.bottom + 8));
    chosen = { x: Math.round(x), y: Math.round(y), t: "translate(-50%,0)" };
  }
  tooltip.style.transform = chosen.t;
  tooltip.style.left = `${chosen.x}px`;
  tooltip.style.top = `${chosen.y}px`;
}

function predictTooltipBounds(c, w, h) {
  if (c.t === "translate(-50%,-100%)") {
    return { left: c.x - w / 2, top: c.y - h, right: c.x + w / 2, bottom: c.y };
  }
  if (c.t === "translate(-50%,0)") {
    return { left: c.x - w / 2, top: c.y, right: c.x + w / 2, bottom: c.y + h };
  }
  if (c.t === "translate(0,-50%)") {
    return { left: c.x, top: c.y - h / 2, right: c.x + w, bottom: c.y + h / 2 };
  }
  if (c.t === "translate(-100%,-50%)") {
    return { left: c.x - w, top: c.y - h / 2, right: c.x, bottom: c.y + h / 2 };
  }
  return { left: c.x, top: c.y, right: c.x + w, bottom: c.y + h };
}

function setTooltipGroupsContent(tooltip, groups) {
  // preserve title element if present
  const titleEl =
    tooltip.firstChild &&
    tooltip.firstChild.dataset &&
    tooltip.firstChild.dataset.overlayTooltipTitle
      ? tooltip.firstChild
      : null;
  tooltip.innerHTML = "";
  if (titleEl) tooltip.appendChild(titleEl);
  groups.forEach((group, idx) => {
    const section = document.createElement("div");
    section.style.display = "grid";
    section.style.gridTemplateColumns = "auto 1fr";
    section.style.columnGap = "8px";
    section.style.rowGap = "4px";
    section.style.alignItems = "baseline";
    const title = document.createElement("div");
    title.textContent = group.title;
    title.style.gridColumn = "1 / -1";
    title.style.fontSize = "11px";
    title.style.letterSpacing = "0.02em";
    title.style.textTransform = "uppercase";
    title.style.color = "#475569";
    title.style.marginTop = idx === 0 ? "0" : "8px";
    title.style.borderTop =
      idx === 0 ? "none" : "1px solid rgba(148, 163, 184, 0.25)";
    title.style.paddingTop = idx === 0 ? "0" : "8px";
    section.appendChild(title);
    group.items.forEach((it) => {
      const keyEl = document.createElement("div");
      if (it.color) {
        const dot = document.createElement("span");
        dot.style.display = "inline-block";
        dot.style.width = "8px";
        dot.style.height = "8px";
        dot.style.borderRadius = "50%";
        dot.style.background = it.color;
        dot.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.08) inset";
        dot.style.marginRight = "6px";
        keyEl.appendChild(dot);
      }
      const keyText = document.createElement("span");
      keyText.textContent = it.key;
      keyEl.appendChild(keyText);
      keyEl.style.fontWeight = "600";
      keyEl.style.color = "#334155";
      keyEl.style.fontSize = "12px";
      const valEl = document.createElement("div");
      valEl.textContent = it.value;
      valEl.style.fontFamily =
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace";
      valEl.style.color = "#0f172a";
      section.appendChild(keyEl);
      section.appendChild(valEl);
    });
    tooltip.appendChild(section);
  });
}

function buildReadableSelector(el) {
  if (!(el instanceof Element)) return "";
  let part = el.tagName.toLowerCase();
  if (el.id) part += `#${el.id}`;
  if (el.classList && el.classList.length) {
    const cls = Array.from(el.classList).join(".");
    if (cls) part += `.${cls}`;
  }
  return part;
}

function formatBoxValues(top, right, bottom, left) {
  const t = normalizeCssLength(top);
  const r = normalizeCssLength(right);
  const b = normalizeCssLength(bottom);
  const l = normalizeCssLength(left);
  if (t === b && r === l) {
    if (t === r) return t; // all same
    return `${t} ${r}`; // vertical horizontal
  }
  return `${t} ${r} ${b} ${l}`;
}

function normalizeCssLength(v) {
  if (v == null) return "0px";
  const s = String(v);
  return s.endsWith("px") ? s : `${s}`;
}

function parsePx(v) {
  if (!v) return 0;
  const s = String(v);
  if (s === "normal") return 0;
  const m = s.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function getEffectiveGaps(style) {
  const display = style.display || "";
  const isFlex = display.includes("flex");
  const isGrid = display.includes("grid");
  let row = parsePx(style.rowGap);
  let col = parsePx(style.columnGap);

  if (isFlex) {
    const dir = style.flexDirection || "row";
    const isRow = dir.startsWith("row");
    return {
      horizontalGap: isRow ? col : row,
      verticalGap: isRow ? row : col,
    };
  }
  if (isGrid) {
    return { horizontalGap: col, verticalGap: row };
  }
  return { horizontalGap: 0, verticalGap: 0 };
}

function computeHorizontalDistanceInfo(tr, hr) {
  if (hr.left >= tr.right) return { distance: Math.round(hr.left - tr.right) };
  if (tr.left >= hr.right) return { distance: Math.round(tr.left - hr.right) };
  return null;
}

function computeVerticalDistanceInfo(tr, hr) {
  if (hr.top >= tr.bottom) return { distance: Math.round(hr.top - tr.bottom) };
  if (tr.top >= hr.bottom) return { distance: Math.round(tr.top - hr.bottom) };
  return null;
}

function positionLayer(id, box) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.transform = `translate(${box.left}px, ${box.top}px)`;
  el.style.width = Math.max(0, box.right - box.left) + "px";
  el.style.height = Math.max(0, box.bottom - box.top) + "px";
}

function removeExistingDistanceLabels(container) {
  const existing = container.querySelectorAll(
    '[data-overlay-distance-label="1"]'
  );
  existing.forEach((n) => n.parentElement && n.parentElement.removeChild(n));
}

function addDistanceLabel(container, x, y, value, side) {
  const label = document.createElement("div");
  label.dataset.overlayDistanceLabel = "1";
  label.textContent = String(value) + "px";
  label.style.position = "fixed";
  label.style.zIndex = String(Z_INDEX_MAX);
  label.style.fontSize = "11px";
  label.style.lineHeight = "1";
  label.style.color = "#ffffff";
  label.style.background = "rgba(3, 7, 18, 0.8)";
  label.style.padding = "2px 4px";
  label.style.borderRadius = "4px";
  label.style.pointerEvents = "none";
  if (side === "top") {
    label.style.transform = `translate(${Math.round(x)}px, ${
      Math.round(y) - 14
    }px) translate(-50%, -100%)`;
  } else if (side === "bottom") {
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(
      y
    )}px) translate(-50%, 0)`;
  } else if (side === "left") {
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(
      y
    )}px) translate(-100%, -50%)`;
  } else if (side === "right") {
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(
      y
    )}px) translate(0, -50%)`;
  }
  container.appendChild(label);
}

function addGapBandRect(container, box, color) {
  const w = Math.max(0, box.right - box.left);
  const h = Math.max(0, box.bottom - box.top);
  if (w <= 0 || h <= 0) return;
  const el = document.createElement("div");
  el.dataset.overlayGap = "1";
  el.style.position = "fixed";
  el.style.left = box.left + "px";
  el.style.top = box.top + "px";
  el.style.width = w + "px";
  el.style.height = h + "px";
  setHatchBackground(el, InspectorColors.gap, 0.55);
  el.style.pointerEvents = "none";
  el.style.zIndex = String(Z_INDEX_MAX - 1);
  container.appendChild(el);
}

function removeGapBands(container) {
  const nodes = container.querySelectorAll('[data-overlay-gap="1"]');
  nodes.forEach((n) => n.parentElement && n.parentElement.removeChild(n));
}

function addPreciseGapBandsForContainer(
  containerEl,
  contentBox,
  containerStyle,
  overlayContainer
) {
  const display = containerStyle.display || "";
  const isFlex = display.includes("flex");
  const isGrid = display.includes("grid");
  if (!isFlex && !isGrid) return;
  const gaps = getEffectiveGaps(containerStyle);
  const hGap = gaps.horizontalGap;
  const vGap = gaps.verticalGap;
  if (hGap <= 0 && vGap <= 0) return;

  const children = Array.from(containerEl.children).filter(
    (c) => c instanceof Element
  );
  const childRects = children
    .map((c) => ({ el: c, rect: c.getBoundingClientRect() }))
    .filter((r) => r.rect.width > 0 && r.rect.height > 0);
  if (childRects.length < 2) return;

  const thresholdY = Math.max(
    8,
    median(childRects.map((r) => r.rect.height)) * 0.3
  );
  const thresholdX = Math.max(
    8,
    median(childRects.map((r) => r.rect.width)) * 0.3
  );

  if (isFlex) {
    const dir = containerStyle.flexDirection || "row";
    const isRow = dir.startsWith("row");
    if (isRow && hGap > 0) {
      const rows = groupByAxis(childRects, "y", thresholdY);
      rows.forEach((row) => {
        row.sort((a, b) => a.rect.left - b.rect.left);
        for (let i = 0; i < row.length - 1; i++) {
          const a = row[i].rect;
          const b = row[i + 1].rect;
          const band = {
            left: Math.max(contentBox.left, a.right),
            right: Math.min(contentBox.right, b.left),
            top: Math.max(contentBox.top, Math.max(a.top, b.top)),
            bottom: Math.min(contentBox.bottom, Math.min(a.bottom, b.bottom)),
          };
          addGapBandRect(overlayContainer, band);
        }
      });
    } else if (!isRow && vGap > 0) {
      const cols = groupByAxis(childRects, "x", thresholdX);
      cols.forEach((col) => {
        col.sort((a, b) => a.rect.top - b.rect.top);
        for (let i = 0; i < col.length - 1; i++) {
          const a = col[i].rect;
          const b = col[i + 1].rect;
          const band = {
            left: Math.max(contentBox.left, Math.max(a.left, b.left)),
            right: Math.min(contentBox.right, Math.min(a.right, b.right)),
            top: Math.max(contentBox.top, a.bottom),
            bottom: Math.min(contentBox.bottom, b.top),
          };
          addGapBandRect(overlayContainer, band);
        }
      });
    }
    return;
  }

  // Grid (approximate per row/column groups)
  if (isGrid) {
    if (hGap > 0) {
      const rows = groupByAxis(childRects, "y", thresholdY);
      rows.forEach((row) => {
        row.sort((a, b) => a.rect.left - b.rect.left);
        for (let i = 0; i < row.length - 1; i++) {
          const a = row[i].rect;
          const b = row[i + 1].rect;
          const band = {
            left: Math.max(contentBox.left, a.right),
            right: Math.min(contentBox.right, b.left),
            top: Math.max(contentBox.top, Math.max(a.top, b.top)),
            bottom: Math.min(contentBox.bottom, Math.min(a.bottom, b.bottom)),
          };
          addGapBandRect(overlayContainer, band);
        }
      });
    }
    if (vGap > 0) {
      const cols = groupByAxis(childRects, "x", thresholdX);
      cols.forEach((col) => {
        col.sort((a, b) => a.rect.top - b.rect.top);
        for (let i = 0; i < col.length - 1; i++) {
          const a = col[i].rect;
          const b = col[i + 1].rect;
          const band = {
            left: Math.max(contentBox.left, Math.max(a.left, b.left)),
            right: Math.min(contentBox.right, Math.min(a.right, b.right)),
            top: Math.max(contentBox.top, a.bottom),
            bottom: Math.min(contentBox.bottom, b.top),
          };
          addGapBandRect(overlayContainer, band);
        }
      });
    }
  }
}

function setHatchBackground(el, hex, alphaOverride) {
  const hatchAlpha =
    typeof alphaOverride === "number"
      ? alphaOverride
      : InspectorOpacity.gapHatch;
  const rgba = hexToRgba(hex, hatchAlpha);
  // Diagonal hatch using repeating-linear-gradient
  el.style.backgroundImage = `repeating-linear-gradient(45deg, ${rgba} 0, ${rgba} 4px, transparent 4px, transparent 8px)`;
  el.style.backgroundColor = hexToRgba(hex, InspectorOpacity.gapBase);
}

function groupByAxis(rects, axis, threshold) {
  const groups = [];
  rects.forEach((r) => {
    const center =
      axis === "y"
        ? (r.rect.top + r.rect.bottom) / 2
        : (r.rect.left + r.rect.right) / 2;
    let g = groups.find((gr) => Math.abs(gr.center - center) <= threshold);
    if (!g) {
      g = { center, items: [] };
      groups.push(g);
    }
    // update running center (simple avg)
    g.items.push(r);
    g.center = (g.center * (g.items.length - 1) + center) / g.items.length;
  });
  return groups.map((g) => g.items);
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
