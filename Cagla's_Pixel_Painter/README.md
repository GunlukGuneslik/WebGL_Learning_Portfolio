# Cagla's Pixel Painter

An interactive, browser-based pixel painting application developed as a Computer Graphics coursework project using JavaScript, HTML, and WebGL.

The application lets users paint on a customizable grid, switch between square and circular brushes, and display smoother filled regions and contours using the Marching Squares algorithm.

## Features

- **Grid-based drawing:** Adjustable resolution from 20 × 20 to 100 × 100.
- **Brush tools:** Square and circular brushes with adjustable thickness from 1 to 5.
- **Color selection:** Black, red, green, and blue for fill and grid lines.
- **Smooth fill:** Marching Squares-based filled polygon visualization.
- **Contours:** Optional contour rendering with customizable thickness and color.
- **Zoom and pan:** Zoom from 1× to 6× and navigate using arrow keys.
- **Drawing history:** Undo, redo, and reset.
- **Save and load:** Export and import drawings in JSON format.

## Getting Started

1. Download or clone the project.
2. Keep `index.html`, `main.js`, `MV.js`, `initShaders.js`, and `webgl-utils.js` in the same directory.
3. Open `index.html` in a modern browser with WebGL support.

No installation, build process, or package manager is required.

## How to Use

- **Draw:** Select a brush, then click and drag on the canvas.
- **Brush settings:** Choose the square or circular brush and adjust its thickness.
- **Grid settings:** Change the resolution and click *Apply Grid Resolution*. This clears the current drawing.
- **Smooth fill and contours:** Use *Soft Fill* and the *View Settings* controls.
- **Zoom:** Select `+` or `-`, then click the canvas. Use arrow keys to pan.
- **Save:** Enter a file name and click *Save Drawing*.
- **Load:** Click *Load Drawing* and select a previously saved `.json` file.
- **History:** Use *Undo*, *Redo*, or *Reset*.

Saved JSON files contain the grid resolution, drawing history, current fill color, and grid-line color. Other interface settings are not included.

## Project Files

| File | Description |
|---|---|
| `index.html` | UI, WebGL canvas, and shaders |
| `main.js` | Drawing logic, rendering, Marching Squares, undo/redo, and save/load |
| `MV.js` | Third-party vector and matrix utilities |
| `initShaders.js` | Third-party shader initialization utilities |
| `webgl-utils.js` | Third-party WebGL context utilities |

## Technologies

- HTML5
- JavaScript
- WebGL / GLSL

## Credits and Third-Party Code

This project was developed for a Computer Graphics course. The painting application code is separate from the following utilities provided with course examples:

- **MV.js and initShaders.js:** Utilities associated with Edward Angel and Dave Shreiner's *Interactive Computer Graphics: A Top-Down Approach with WebGL*.
- **webgl-utils.js:** WebGL utility code carrying a Google Inc. copyright notice and BSD-style redistribution terms. The original copyright and license notice must be preserved.

These third-party files are not claimed as original project work.
