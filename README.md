# 0machine Nest — Autonomous CAD/CAM Nesting Engine

An industrial-grade 2D irregular nesting web application built with high-performance computational geometry, genetic optimization, parts-in-parts hole nesting, common-line cutting detection, and real-time material quotation (Devis in MAD).

![0machine Nest Preview](https://raw.githubusercontent.com/anouar1990/0machine-nest/main/preview.png)

---

## ✨ Features

- **⚡ Genetic Irregular Nesting Engine**:
  - Heuristic bottom-left placement with collision detection via ClipperLib and SAT (Separating Axis Theorem).
  - Multi-generation genetic algorithm (selection, mutation, rotation permutations).
  - Multi-sheet automatic packing when parts exceed a single sheet.

- **🕳️ Nest Inside Holes (Parts-in-Parts)**:
  - Automatically identifies cutouts and holes inside parent shapes.
  - Treats internal holes as virtual sub-bins, packing smaller parts inside waste areas to maximize sheet yield.

- **✂️ Common-Line Cutting (Shared Edge / Twin Cut)**:
  - Detects collinear adjacent edges between parts within machine kerf tolerance.
  - Enables single-pass laser/plasma cutting, saving ~20-30% on piercing cycles and laser travel distance.
  - Highlighted in real-time with vibrant cyan laser guides.

- **📐 Direct DXF & SVG Import**:
  - Full ASCII DXF parser (`LWPOLYLINE`, `POLYLINE`, `CIRCLE`, `LINE` stitcher, bulge arc interpolation).
  - Automated hole vs. outer contour classification.
  - Drag-and-drop support for DXF (AutoCAD, SolidWorks, Fusion 360) and standard SVG files.

- **🇲🇦 Real-Time Devis & Quotation Engine (MAD / Moroccan Dirhams)**:
  - Instant pricing calculations for **Mild Steel (Acier doux S235)**, **Stainless Steel (Inox 304)**, **Aluminum (Alu 5083)**, **Brass (Laiton)**, and **Wood / MDF**.
  - Dynamic thickness adjustments (1.5mm to 10mm).
  - Weight calculation, laser cutting minutes, machine hourly rate, scrap waste cost, and common-line savings.
  - Print-ready official Devis / PDF export.

- **🎨 0machine Industrial Design System**:
  - Dark Slate `#0A0C12` background with subtle CAD engineering grid.
  - 0machine signature neon orange `#FE7733` accents and glassmorphic telemetry cards.
  - Interactive pan, scroll zoom, and responsive CAD viewport.

---

## 🚀 Quick Start

Run locally with any static web server:

```bash
# Python 3
python3 -m http.server 3388

# Or Node.js
npx serve -l 3388
```

Open [http://localhost:3388](http://localhost:3388) in your browser.

---

## 📁 Project Architecture

```
0machine-nest/
├── index.html              # Modern 3-column CAD workspace layout
├── styles.css              # 0machine industrial design system & HUD cards
├── app.js                  # Viewport, Pan/Zoom, Event wiring, & Devis bindings
├── engine/
│   ├── clipper.js          # ClipperLib for exact polygon Boolean math & kerf offsets
│   ├── geometry.js         # SAT collision, perimeters, area, and collinear shared edge detector
│   ├── dxf-parser.js       # Native ASCII DXF parser with bulge arc expansion
│   ├── cost-calculator.js  # Industrial material weight, cutting speed, & MAD quotation engine
│   └── nester.js           # Multi-sheet genetic optimizer & bottom-left placer
└── samples/
    ├── sample_bracket.dxf  # Industrial L-bracket sample
    └── sample_flange.dxf   # Hollow motor flange sample with bolt holes
```

---

## 🛠️ Tech Stack

- **Vanilla JavaScript (ES6+)**: Zero framework bloat, instant 60 FPS canvas rendering.
- **HTML5 Canvas**: Hardware-accelerated 2D CAD rendering with pan & zoom.
- **ClipperLib**: Robust polygon clipping and offsetting.
- **CSS3 Glassmorphism**: Neon industrial HUD aesthetics.

---

## 📄 License

Proprietary © 0machine. Built for CNC, Laser, Plasma, and Waterjet cutting operations.
