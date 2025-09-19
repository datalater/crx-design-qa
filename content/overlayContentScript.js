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
    if (message.type === window.__overlayCompare?.MessageType?.FIT_OVERLAY_TO_VIEWPORT_WIDTH) {
      fitOverlayToViewportWidth();
      reportOverlayState();
    }
    if (message.type === window.__overlayCompare?.MessageType?.APPLY_GLOBAL_OUTLINE) {
      applyGlobalOutlineToDocumentAndShadows();
    }
    if (message.type === window.__overlayCompare?.MessageType?.REMOVE_GLOBAL_OUTLINE) {
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
    if (message.type === window.__overlayCompare?.MessageType?.GET_VIEWPORT_INFO) {
      reportViewportInfo();
    }
  });
}

function fitOverlayToViewportWidth() {
  const container = document.getElementById(OverlayDomIds.container);
  const image = document.getElementById(OverlayDomIds.image);
  if (!container || !image) return;
  const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || overlayState.width || 0);
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
  const isInputLike = tagName === "input" || tagName === "textarea" || tagName === "select";
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
        window.innerWidth || document.documentElement.clientWidth || naturalWidth
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

  const widthProvided = Object.prototype.hasOwnProperty.call(newProperties, "width");
  const heightProvided = Object.prototype.hasOwnProperty.call(newProperties, "height");

  if (maintainAspectRatio) {
    if (widthProvided && !heightProvided) {
      nextWidth = Math.max(nextWidth, OverlayDefaults.minWidth);
      nextHeight = Math.max(Math.round(nextWidth / requested.aspectRatio), OverlayDefaults.minHeight);
    } else if (!widthProvided && heightProvided) {
      nextHeight = Math.max(nextHeight, OverlayDefaults.minHeight);
      nextWidth = Math.max(Math.round(nextHeight * requested.aspectRatio), OverlayDefaults.minWidth);
    } else if (widthProvided && heightProvided) {
      nextWidth = Math.max(nextWidth, OverlayDefaults.minWidth);
      nextHeight = Math.max(Math.round(nextWidth / requested.aspectRatio), OverlayDefaults.minHeight);
    } else {
      nextWidth = Math.max(nextWidth, OverlayDefaults.minWidth);
      nextHeight = Math.max(Math.round(nextWidth / requested.aspectRatio), OverlayDefaults.minHeight);
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
  container.style.zIndex = String(2147483647);
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
  const aspectRatio = overlayState.aspectRatio > 0 ? overlayState.aspectRatio : 0;
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

  updateOverlayProperties({ positionX: nextX, positionY: nextY, width: Math.round(targetWidth), height: Math.round(targetHeight) });
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
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.shadowRoot) injectOutlineStyleIntoRoot(node.shadowRoot);
  }
}

function removeGlobalOutlineFromDocumentAndShadows() {
  removeOutlineStyleFromRoot(document);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
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
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

