# Image Overlay Compare (Chrome Extension)

A Manifest V3 Chrome extension to paste a reference image (e.g., exported from Figma) and overlay it on top of any webpage for quick, manual visual comparison. Supports drag, resize, opacity, and blend mode (difference, etc.).

## Load in Chrome

- Open `chrome://extensions`.
- Enable Developer mode.
- Click "Load unpacked" and select this folder.

## Usage

- Open your target page in a tab.
- Click the extension icon to open the popup.
- Paste a clipboard image into the popup (Cmd/Ctrl+V) or focus the drop zone and paste there.
- Or click "Paste from Clipboard" to fetch via the Clipboard API (requires user gesture and permission).
- Each paste adds to the Image Library. Select any saved image to insert; it stays in memory until you close the popup.
- Preview appears with natural size info; adjust x, y, width, height, opacity, and blend mode in the popup.
- Click "Insert Overlay" to place it on the current tab.
- Drag the overlay to align; use corner handles to resize.
- Use popup "Apply Changes" to set precise values.
- Click "Remove Overlay" to clear it.

## Design and Code Principles

- Clear, screaming-architecture oriented folders: `popup`, `content`, `shared`.
- Full, descriptive names for variables and functions.
- Top-down file structure: main entry at the top of each script.
- Constants and configuration extracted into dedicated modules.
- Small, focused functions that do one thing.

## Files

- `manifest.json`: MV3 configuration.
- `popup/`: Extension popup UI and logic.
  - `popup.html`, `popup.css`, `popup.js`
- `content/`: Content script that renders and manages the overlay in pages.
  - `overlayContentScript.js`
- `shared/`: Shared constants used by popup and content.
  - `messages.js`

## Notes and Limitations

- The overlay uses very high z-index and fixed positioning; some pages with special UI may require temporary page interaction blocking while aligning.
- Some sites (e.g., `chrome://` pages) do not allow content script injection.
- Keep Chrome zoom at 100% and ensure correct DPR to minimize anti-aliasing differences.

## Next Steps (Optional)

- Keyboard nudging (arrow keys) with step/accelerated step support.
- Snap-to-edges and guide lines for quick alignment.
- Mask regions to ignore dynamic content.
- Add visual diff (pixelmatch) as a separate step.
