const MessageType = {
  INSERT_OVERLAY: "INSERT_OVERLAY",
  UPDATE_OVERLAY: "UPDATE_OVERLAY",
  REMOVE_OVERLAY: "REMOVE_OVERLAY",
  REQUEST_OVERLAY_STATE: "REQUEST_OVERLAY_STATE",
  REPORT_OVERLAY_STATE: "REPORT_OVERLAY_STATE",
  FIT_OVERLAY_TO_VIEWPORT_WIDTH: "FIT_OVERLAY_TO_VIEWPORT_WIDTH",
  GET_VIEWPORT_INFO: "GET_VIEWPORT_INFO",
  REPORT_VIEWPORT_INFO: "REPORT_VIEWPORT_INFO",
  APPLY_GLOBAL_OUTLINE: "APPLY_GLOBAL_OUTLINE",
  REMOVE_GLOBAL_OUTLINE: "REMOVE_GLOBAL_OUTLINE",
  START_SPACING_INSPECTOR: "START_SPACING_INSPECTOR",
  STOP_SPACING_INSPECTOR: "STOP_SPACING_INSPECTOR"
};

const DefaultOverlayProperties = {
  positionX: 0,
  positionY: 0,
  width: 0,
  height: 0,
  opacity: 0.5,
  blendMode: "normal"
};

window.__overlayCompare = window.__overlayCompare || {};
window.__overlayCompare.MessageType = MessageType;
window.__overlayCompare.DefaultOverlayProperties = DefaultOverlayProperties;
