function initializePopup() {
  const state = createInitialPopupState();
  const elements = queryPopupElements();
  wirePasteHandler(elements, state);
  wireButtons(elements, state);
  wireControls(elements, state);
  requestOverlayStateAndPopulateInputs(elements);
  renderImageLibrary(elements, state);
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
    imageLibraryList: document.getElementById("imageLibraryList"),
    clipboardPreviewContainer: document.getElementById(
      "clipboardPreviewContainer"
    ),
    clipboardPreviewImage: document.getElementById("clipboardPreviewImage"),
    clipboardInfo: document.getElementById("clipboardInfo"),
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
    item.appendChild(thumb);
    item.appendChild(meta);
    item.addEventListener("click", () => {
      state.selectedImageId = img.id;
      renderImageLibrary(elements, state);
      updatePreview(elements, img.dataUrl);
      setStatus(elements, "Image selected.");
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
  };
  image.src = dataUrl;
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
  });
  sendMessageToActiveTab({
    type: window.__overlayCompare.MessageType.REQUEST_OVERLAY_STATE,
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

document.addEventListener("DOMContentLoaded", initializePopup);
