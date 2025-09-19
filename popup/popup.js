const StorageKeys = {
  imageLibrary: "overlayCompare.imageLibrary",
  selectedImageId: "overlayCompare.selectedImageId",
};

function initializePopup() {
  const state = createInitialPopupState();
  const elements = queryPopupElements();
  wirePasteHandler(elements, state);
  wireDropAndFileHandlers(elements, state);
  wireButtons(elements, state);
  wireControls(elements, state);
  wireViewportControls(elements);
  requestOverlayStateAndPopulateInputs(elements);
  requestViewportInfoAndDisplay(elements);
  restoreImageLibraryFromStorage(elements, state).then(() => {
    renderImageLibrary(elements, state);
  });
}

function createInitialPopupState() {
  return {
    images: [],
    selectedImageId: null,
  };
}

function queryPopupElements() {
  return {
    clipboardDropZone: document.getElementById("clipboardDropZone"),
    uploadImageButton: document.getElementById("uploadImageButton"),
    fileInputHidden: document.getElementById("fileInputHidden"),
    imageLibraryList: document.getElementById("imageLibraryList"),
    clipboardPreviewContainer: document.getElementById(
      "clipboardPreviewContainer"
    ),
    clipboardPreviewImage: document.getElementById("clipboardPreviewImage"),
    clipboardInfo: document.getElementById("clipboardInfo"),
    displayViewportSize: document.getElementById("displayViewportSize"),
    displayViewportDpr: document.getElementById("displayViewportDpr"),
    refreshViewportInfoButton: document.getElementById("refreshViewportInfoButton"),
    positionXInput: document.getElementById("positionXInput"),
    positionYInput: document.getElementById("positionYInput"),
    widthInput: document.getElementById("widthInput"),
    heightInput: document.getElementById("heightInput"),
    opacityInput: document.getElementById("opacityInput"),
    blendModeSelect: document.getElementById("blendModeSelect"),
    insertButton: document.getElementById("insertButton"),
    fitViewportWidthButton: document.getElementById("fitViewportWidthButton"),
    applyButton: document.getElementById("applyButton"),
    removeButton: document.getElementById("removeButton"),
    viewportWidthInput: document.getElementById("viewportWidthInput"),
    viewportHeightInput: document.getElementById("viewportHeightInput"),
    viewportDprInput: document.getElementById("viewportDprInput"),
    applyViewportButton: document.getElementById("applyViewportButton"),
    resetViewportButton: document.getElementById("resetViewportButton"),
    applyOutlineButton: document.getElementById("applyOutlineButton"),
    removeOutlineButton: document.getElementById("removeOutlineButton"),
    startSpacingInspectorButton: document.getElementById("startSpacingInspectorButton"),
    stopSpacingInspectorButton: document.getElementById("stopSpacingInspectorButton"),
    statusText: document.getElementById("statusText"),
  };
}

function wirePasteHandler(elements, state) {
  function handleClipboardData(clipboardEvent) {
    const clipboardItems =
      clipboardEvent.clipboardData && clipboardEvent.clipboardData.items;
    if (!clipboardItems || clipboardItems.length === 0) return;
    const imageItem = Array.from(clipboardItems).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const dataUrl = fileReader.result;
      addImageToLibrary(elements, state, dataUrl);
    };
    fileReader.readAsDataURL(blob);
  }

  elements.clipboardDropZone.addEventListener("paste", handleClipboardData);
  document.addEventListener("paste", handleClipboardData);

  const pasteFromClipboardButton = document.getElementById("pasteFromClipboardButton");
  if (pasteFromClipboardButton) {
    pasteFromClipboardButton.addEventListener("click", async () => {
      try {
        setStatus(elements, "Reading clipboard...");
        const blob = await readImageBlobFromClipboard();
        if (!blob) {
          setStatus(elements, "No image in clipboard.");
          return;
        }
        const dataUrl = await convertBlobToDataUrl(blob);
        addImageToLibrary(elements, state, dataUrl);
      } catch (error) {
        setStatus(elements, "Clipboard read failed. Use Cmd/Ctrl+V.");
      }
    });
  }
}

function wireDropAndFileHandlers(elements, state) {
  const zone = elements.clipboardDropZone;
  if (!zone) return;
  const addDragOverStyle = () => zone.classList.add("drag-over");
  const removeDragOverStyle = () => zone.classList.remove("drag-over");

  zone.addEventListener("dragenter", (e) => { e.preventDefault(); addDragOverStyle(); });
  zone.addEventListener("dragover", (e) => { e.preventDefault(); addDragOverStyle(); });
  zone.addEventListener("dragleave", (e) => { e.preventDefault(); removeDragOverStyle(); });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    removeDragOverStyle();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;
    handleImageFiles(Array.from(files));
  });

  if (elements.uploadImageButton && elements.fileInputHidden) {
    elements.uploadImageButton.addEventListener("click", () => {
      elements.fileInputHidden.click();
    });
    elements.fileInputHidden.addEventListener("change", () => {
      const files = elements.fileInputHidden.files;
      if (files && files.length) handleImageFiles(Array.from(files));
      elements.fileInputHidden.value = "";
    });
  }

  function handleImageFiles(files) {
    const imageFiles = files.filter((f) => f.type && f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        addImageToLibrary(elements, state, dataUrl);
      };
      reader.readAsDataURL(file);
    });
  }
}

function wireButtons(elements, state) {
  elements.insertButton.addEventListener("click", async () => {
    const selected = getSelectedImage(state);
    if (!selected) {
      setStatus(elements, "Select or paste an image first.");
      return;
    }
    const properties = readOverlayPropertiesFromInputs(elements);
    await sendMessageToActiveTab({
      type: window.__overlayCompare.MessageType.INSERT_OVERLAY,
      payload: {
        imageDataUrl: selected.dataUrl,
        properties,
      },
    });
    setStatus(elements, "Overlay inserted.");
  });

  elements.fitViewportWidthButton.addEventListener("click", async () => {
    await sendMessageToActiveTab({
      type: window.__overlayCompare.MessageType.FIT_OVERLAY_TO_VIEWPORT_WIDTH,
    });
    setStatus(elements, "Fitted to viewport width.");
  });

  elements.applyButton.addEventListener("click", async () => {
    await applyOverlayChangesFromInputs(elements);
  });

  elements.removeButton.addEventListener("click", async () => {
    await sendMessageToActiveTab({
      type: window.__overlayCompare.MessageType.REMOVE_OVERLAY,
    });
    setStatus(elements, "Overlay removed.");
  });

  if (elements.applyOutlineButton) {
    elements.applyOutlineButton.addEventListener("click", async () => {
      await sendMessageToActiveTab({ type: window.__overlayCompare.MessageType.APPLY_GLOBAL_OUTLINE });
      setStatus(elements, "Outline applied.");
    });
  }
  if (elements.removeOutlineButton) {
    elements.removeOutlineButton.addEventListener("click", async () => {
      await sendMessageToActiveTab({ type: window.__overlayCompare.MessageType.REMOVE_GLOBAL_OUTLINE });
      setStatus(elements, "Outline removed.");
    });
  }

  if (elements.startSpacingInspectorButton) {
    elements.startSpacingInspectorButton.addEventListener("click", async () => {
      await sendMessageToActiveTab({ type: window.__overlayCompare.MessageType.START_SPACING_INSPECTOR });
      setStatus(elements, "Spacing inspector started. Esc or Exit to stop.");
    });
  }
  if (elements.stopSpacingInspectorButton) {
    elements.stopSpacingInspectorButton.addEventListener("click", async () => {
      await sendMessageToActiveTab({ type: window.__overlayCompare.MessageType.STOP_SPACING_INSPECTOR });
      setStatus(elements, "Spacing inspector stopped.");
    });
  }

  // Scroll lock UI removed per request
}

function wireViewportControls(elements) {
  if (!elements.applyViewportButton || !elements.resetViewportButton) return;
  elements.applyViewportButton.addEventListener("click", async () => {
    try {
      await applyViewportEmulation(elements);
      setStatus(elements, "Viewport emulation applied.");
    } catch (e) {
      const errorText = (e && e.message) || "Failed to apply viewport.";
      setStatus(elements, errorText);
    }
  });
  elements.resetViewportButton.addEventListener("click", async () => {
    try {
      await resetViewportEmulation();
      setStatus(elements, "Viewport emulation cleared.");
    } catch (e) {
      const errorText = (e && e.message) || "Failed to reset viewport.";
      setStatus(elements, errorText);
    }
  });

  const applyOnEnter = async (event) => {
    const isEnter = event.key === "Enter" || event.keyCode === 13;
    if (!isEnter) return;
    event.preventDefault();
    try {
      await applyViewportEmulation(elements);
      setStatus(elements, "Viewport emulation applied.");
    } catch (e) {
      const errorText = (e && e.message) || "Failed to apply viewport.";
      setStatus(elements, errorText);
    }
  };
  if (elements.viewportWidthInput)
    elements.viewportWidthInput.addEventListener("keydown", applyOnEnter);
  if (elements.viewportHeightInput)
    elements.viewportHeightInput.addEventListener("keydown", applyOnEnter);
  if (elements.viewportDprInput)
    elements.viewportDprInput.addEventListener("keydown", applyOnEnter);
}

async function applyViewportEmulation(elements) {
  const width = Number(elements.viewportWidthInput.value || 0);
  const height = Number(elements.viewportHeightInput.value || 0);
  const deviceScaleFactor = Number(elements.viewportDprInput.value || 1);
  if (!(width > 0 && height > 0 && deviceScaleFactor > 0)) {
    throw new Error("Invalid viewport inputs");
  }
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab");
  const target = { tabId: tab.id };
  await ensureDebuggerAttached(target);
  try {
    await new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(
        target,
        "Emulation.setDeviceMetricsOverride",
        {
          width,
          height,
          deviceScaleFactor,
          mobile: false,
          screenWidth: width,
          screenHeight: height,
          scale: 1,
        },
        () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        }
      );
    });
  } finally {
    // Keep attached so emulation persists. Detach only on explicit reset.
  }
}

async function resetViewportEmulation() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab");
  const target = { tabId: tab.id };
  await ensureDebuggerAttached(target);
  try {
    await new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(
        target,
        "Emulation.clearDeviceMetricsOverride",
        {},
        () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        }
      );
    });
  } finally {
    await ensureDebuggerDetached(target);
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureDebuggerAttached(target) {
  await new Promise((resolve, reject) => {
    chrome.debugger.attach(target, "1.3", () => {
      const err = chrome.runtime.lastError;
      if (!err) return resolve();
      const msg = String(err.message || err).toLowerCase();
      if (msg.includes("already attached")) return resolve();
      if (msg.includes("another debugger is already attached")) {
        return reject(new Error("Close DevTools: tab is already being debugged."));
      }
      return reject(err);
    });
  });
}

async function ensureDebuggerDetached(target) {
  await new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve());
  });
}

function wireControls(elements, state) {
  const inputs = [
    elements.positionXInput,
    elements.positionYInput,
    elements.widthInput,
    elements.heightInput,
    elements.opacityInput,
    elements.blendModeSelect,
  ];
  inputs.forEach((input) => {
    input.addEventListener("change", () =>
      setStatus(elements, "Unsaved changes.")
    );
    input.addEventListener("input", () =>
      setStatus(elements, "Unsaved changes.")
    );
  });

  const applyOnEnter = async (event) => {
    const isEnterKey = event.key === "Enter" || event.keyCode === 13;
    if (!isEnterKey) return;
    event.preventDefault();
    await applyOverlayChangesFromInputs(elements);
  };
  elements.widthInput.addEventListener("keydown", applyOnEnter);
  elements.heightInput.addEventListener("keydown", applyOnEnter);

  elements.opacityInput.addEventListener("input", async () => {
    const raw = Number(elements.opacityInput.value || 0);
    const opacity = Math.max(0, Math.min(1, raw));
    await sendOverlayPartialUpdate({ opacity });
    setStatus(elements, "Opacity updated.");
  });

  elements.positionXInput.addEventListener("input", async () => {
    const positionX = Number(elements.positionXInput.value || 0);
    await sendOverlayPartialUpdate({ positionX });
    setStatus(elements, "Position updated.");
  });
  elements.positionYInput.addEventListener("input", async () => {
    const positionY = Number(elements.positionYInput.value || 0);
    await sendOverlayPartialUpdate({ positionY });
    setStatus(elements, "Position updated.");
  });
}

function readOverlayPropertiesFromInputs(elements) {
  const positionX = Number(elements.positionXInput.value || 0);
  const positionY = Number(elements.positionYInput.value || 0);
  const width = Number(elements.widthInput.value || 0);
  const height = Number(elements.heightInput.value || 0);
  const opacity = Number(elements.opacityInput.value || 0.5);
  const blendMode = elements.blendModeSelect.value || "normal";
  return { positionX, positionY, width, height, opacity, blendMode };
}

function populateInputsFromOverlayState(elements, overlayState) {
  if (!overlayState) return;
  const { positionX, positionY, width, height, opacity, blendMode } =
    overlayState;
  elements.positionXInput.value = String(positionX ?? 0);
  elements.positionYInput.value = String(positionY ?? 0);
  elements.widthInput.value = String(width ?? 0);
  elements.heightInput.value = String(height ?? 0);
  elements.opacityInput.value = String(opacity ?? 0.5);
  elements.blendModeSelect.value = String(blendMode ?? "normal");
}

function updatePreview(elements, dataUrl) {
  elements.clipboardPreviewImage.src = dataUrl;
  const image = new Image();
  image.onload = () => {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    elements.clipboardInfo.textContent = `${width} × ${height}`;
    if (!Number(elements.widthInput.value))
      elements.widthInput.value = String(width);
    if (!Number(elements.heightInput.value))
      elements.heightInput.value = String(height);
  };
  image.src = dataUrl;
}

function renderImageLibrary(elements, state) {
  const list = elements.imageLibraryList;
  if (!list) return;
  list.innerHTML = "";
  state.images.forEach((img) => {
    const item = document.createElement("div");
    item.className = "library-item" + (img.id === state.selectedImageId ? " selected" : "");
    item.dataset.imageId = img.id;
    const thumb = document.createElement("img");
    thumb.className = "library-thumb";
    thumb.src = img.dataUrl;
    const meta = document.createElement("div");
    meta.className = "library-meta";
    meta.textContent = `${img.width}×${img.height}`;
    const actions = document.createElement("div");
    actions.className = "library-actions";
    const copyButton = document.createElement("button");
    copyButton.className = "library-copy-button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      try {
        await copyImageDataUrlToClipboard(img.dataUrl);
        setStatus(elements, "Image copied to clipboard.");
      } catch (e) {
        setStatus(elements, "Failed to copy image.");
      }
    });
    const deleteButton = document.createElement("button");
    deleteButton.className = "library-delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteImageFromLibrary(elements, state, img.id);
    });
    actions.appendChild(copyButton);
    actions.appendChild(deleteButton);
    item.appendChild(thumb);
    item.appendChild(meta);
    item.appendChild(actions);
    item.addEventListener("click", () => {
      state.selectedImageId = img.id;
      renderImageLibrary(elements, state);
      updatePreview(elements, img.dataUrl);
      setStatus(elements, "Image selected.");
      persistImageLibraryToStorage(state);
    });
    list.appendChild(item);
  });
}

function getSelectedImage(state) {
  if (!state.selectedImageId) return null;
  return state.images.find((i) => i.id === state.selectedImageId) || null;
}

function addImageToLibrary(elements, state, dataUrl) {
  const image = new Image();
  image.onload = () => {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    state.images.unshift({ id, dataUrl, width, height, createdAt: Date.now() });
    state.selectedImageId = id;
    renderImageLibrary(elements, state);
    updatePreview(elements, dataUrl);
    if (!Number(elements.widthInput.value)) elements.widthInput.value = String(width);
    if (!Number(elements.heightInput.value)) elements.heightInput.value = String(height);
    setStatus(elements, "Image added to library.");
    persistImageLibraryToStorage(state);
  };
  image.src = dataUrl;
}

function deleteImageFromLibrary(elements, state, imageId) {
  const index = state.images.findIndex((i) => i.id === imageId);
  if (index === -1) return;
  const wasSelected = state.selectedImageId === imageId;
  state.images.splice(index, 1);
  if (wasSelected) {
    state.selectedImageId = state.images.length ? state.images[0].id : null;
    const selected = getSelectedImage(state);
    if (selected) {
      updatePreview(elements, selected.dataUrl);
    } else {
      clearPreview(elements);
    }
  }
  renderImageLibrary(elements, state);
  persistImageLibraryToStorage(state);
}

function clearPreview(elements) {
  if (elements.clipboardPreviewImage) elements.clipboardPreviewImage.src = "";
  if (elements.clipboardInfo) elements.clipboardInfo.textContent = "";
}

async function copyImageDataUrlToClipboard(dataUrl) {
  const blob = await dataUrlToBlob(dataUrl);
  if (navigator.clipboard && navigator.clipboard.write) {
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
  } else {
    throw new Error("Clipboard write not supported");
  }
}

function dataUrlToBlob(dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      resolve(new Blob([u8arr], { type: mime }));
    } catch (e) {
      reject(e);
    }
  });
}

function restoreImageLibraryFromStorage(elements, state) {
  return new Promise((resolve) => {
    chrome.storage.local.get([StorageKeys.imageLibrary, StorageKeys.selectedImageId], (result) => {
      const images = result[StorageKeys.imageLibrary] || [];
      const selectedImageId = result[StorageKeys.selectedImageId] || null;
      if (Array.isArray(images)) state.images = images;
      if (typeof selectedImageId === "string") state.selectedImageId = selectedImageId;
      const selected = getSelectedImage(state);
      if (selected) updatePreview(elements, selected.dataUrl);
      resolve();
    });
  });
}

function persistImageLibraryToStorage(state) {
  chrome.storage.local.set({
    [StorageKeys.imageLibrary]: state.images,
    [StorageKeys.selectedImageId]: state.selectedImageId,
  });
}

async function sendMessageToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  return chrome.tabs.sendMessage(tab.id, message);
}

function setStatus(elements, text) {
  elements.statusText.textContent = text;
}

function requestOverlayStateAndPopulateInputs(elements) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message &&
      message.type === window.__overlayCompare.MessageType.REPORT_OVERLAY_STATE
    ) {
      populateInputsFromOverlayState(
        elements,
        message.payload && message.payload.overlayState
      );
    }
    if (
      message &&
      message.type === window.__overlayCompare.MessageType.REPORT_VIEWPORT_INFO
    ) {
      const vp = message.payload && message.payload.viewport;
      if (vp && elements.displayViewportSize && elements.displayViewportDpr) {
        elements.displayViewportSize.textContent = `${vp.width} × ${vp.height}`;
        elements.displayViewportDpr.textContent = String(vp.devicePixelRatio);
      }
    }
  });
  sendMessageToActiveTab({
    type: window.__overlayCompare.MessageType.REQUEST_OVERLAY_STATE,
  });
}

function requestViewportInfoAndDisplay(elements) {
  if (elements.refreshViewportInfoButton) {
    elements.refreshViewportInfoButton.addEventListener("click", () => {
      sendMessageToActiveTab({
        type: window.__overlayCompare.MessageType.GET_VIEWPORT_INFO,
      });
    });
  }
  sendMessageToActiveTab({
    type: window.__overlayCompare.MessageType.GET_VIEWPORT_INFO,
  });
}

async function readImageBlobFromClipboard() {
  if (!navigator.clipboard || !navigator.clipboard.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find(t => t.startsWith("image/"));
    if (type) {
      const blob = await item.getType(type);
      return blob;
    }
  }
  return null;
}

function convertBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function applyOverlayChangesFromInputs(elements) {
  const properties = readOverlayPropertiesFromInputs(elements);
  await sendMessageToActiveTab({
    type: window.__overlayCompare.MessageType.UPDATE_OVERLAY,
    payload: { properties },
  });
  setStatus(elements, "Overlay updated.");
}

async function sendOverlayPartialUpdate(properties) {
  await sendMessageToActiveTab({
    type: window.__overlayCompare.MessageType.UPDATE_OVERLAY,
    payload: { properties },
  });
}

document.addEventListener("DOMContentLoaded", initializePopup);
