/**
 * 0machine Auto-Nesting UI & Canvas Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    // Canvas setup
    const canvas = document.getElementById('nestCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvasContainer');

    // State
    let zoom = 0.85;
    let panX = 40;
    let panY = 40;
    let isDragging = false;
    let startX = 0, startY = 0;

    // Initialize Nester
    const nester = new Nester({
        sheetWidth: 1000,
        sheetHeight: 600,
        spacing: 4,
        margin: 8,
        rotations: 4,
        maxGenerations: 50
    });

    // Color Palette based on 0machine & Neon Accents
    const colorPalette = [
        '#FE7733', '#FF925C', '#6366F1', '#38BDF8', 
        '#10B981', '#F59E0B', '#EC4899', '#A855F7'
    ];

    // Presets library: Industrial parts for CNC/Laser/Plasma
    const presetParts = [
        {
            name: 'Gantry Frame (Cutout)',
            polygon: [
                { x: 0, y: 0 }, { x: 260, y: 0 }, { x: 260, y: 190 }, { x: 0, y: 190 }
            ],
            holes: [
                [
                    { x: 45, y: 35 }, { x: 215, y: 35 }, { x: 215, y: 155 }, { x: 45, y: 155 }
                ]
            ],
            quantity: 2,
            color: '#EC4899'
        },
        {
            name: 'Mount Flange (Hollow)',
            polygon: [
                { x: 45, y: 0 }, { x: 135, y: 0 }, { x: 180, y: 45 },
                { x: 180, y: 135 }, { x: 135, y: 180 }, { x: 45, y: 180 },
                { x: 0, y: 135 }, { x: 0, y: 45 }
            ],
            holes: [
                [
                    { x: 45, y: 45 }, { x: 135, y: 45 }, { x: 135, y: 135 }, { x: 45, y: 135 }
                ]
            ],
            quantity: 2,
            color: '#F59E0B'
        },
        {
            name: 'L-Bracket 90-Deg',
            polygon: [
                { x: 0, y: 0 }, { x: 140, y: 0 }, { x: 140, y: 40 },
                { x: 45, y: 40 }, { x: 45, y: 140 }, { x: 0, y: 140 }
            ],
            quantity: 4,
            color: '#FE7733'
        },
        {
            name: 'Gusset Plate',
            polygon: [
                { x: 0, y: 0 }, { x: 110, y: 0 }, { x: 110, y: 50 },
                { x: 50, y: 110 }, { x: 0, y: 110 }
            ],
            quantity: 4,
            color: '#FF925C'
        },
        {
            name: 'Hex Flange',
            polygon: [
                { x: 40, y: 0 }, { x: 80, y: 0 }, { x: 120, y: 35 },
                { x: 100, y: 80 }, { x: 20, y: 80 }, { x: 0, y: 35 }
            ],
            quantity: 4,
            color: '#6366F1'
        },
        {
            name: 'Motor Mount',
            polygon: [
                { x: 0, y: 25 }, { x: 30, y: 25 }, { x: 30, y: 0 },
                { x: 90, y: 0 }, { x: 90, y: 25 }, { x: 120, y: 25 },
                { x: 120, y: 85 }, { x: 0, y: 85 }
            ],
            quantity: 4,
            color: '#38BDF8'
        },
        {
            name: 'Cam Arm',
            polygon: [
                { x: 0, y: 15 }, { x: 35, y: 0 }, { x: 150, y: 10 },
                { x: 165, y: 35 }, { x: 135, y: 55 }, { x: 25, y: 45 }
            ],
            quantity: 4,
            color: '#10B981'
        }
    ];

    // Load presets initially
    presetParts.forEach(p => nester.addPart(p));

    // UI Elements
    const partsListEl = document.getElementById('partsList');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resetBtn = document.getElementById('resetBtn');
    const exportBtn = document.getElementById('exportBtn');
    const statusPill = document.getElementById('statusPill');
    const statusText = document.getElementById('statusText');

    // Controls
    const sheetWidthInput = document.getElementById('sheetWidth');
    const sheetHeightInput = document.getElementById('sheetHeight');
    const spacingSlider = document.getElementById('spacingSlider');
    const spacingVal = document.getElementById('spacingVal');
    const marginSlider = document.getElementById('marginSlider');
    const marginVal = document.getElementById('marginVal');
    const rotationsSelect = document.getElementById('rotationsSelect');
    const useHolesToggle = document.getElementById('useHolesToggle');
    const commonLineToggle = document.getElementById('commonLineToggle');

    // Tabs & Devis Elements
    const tabTelemetryBtn = document.getElementById('tabTelemetryBtn');
    const tabDevisBtn = document.getElementById('tabDevisBtn');
    const telemetryTabContent = document.getElementById('telemetryTabContent');
    const devisTabContent = document.getElementById('devisTabContent');
    const materialSelect = document.getElementById('materialSelect');
    const thicknessSelect = document.getElementById('thicknessSelect');
    const devisSavingsPill = document.getElementById('devisSavingsPill');
    const devisWeight = document.getElementById('devisWeight');
    const devisMaterialCost = document.getElementById('devisMaterialCost');
    const devisTime = document.getElementById('devisTime');
    const devisMachineCost = document.getElementById('devisMachineCost');
    const devisSharedCut = document.getElementById('devisSharedCut');
    const devisTotalMAD = document.getElementById('devisTotalMAD');
    const devisUnitPart = document.getElementById('devisUnitPart');
    const printDevisBtn = document.getElementById('printDevisBtn');

    // Cost Calculator
    const costCalc = new CostCalculator();

    // HUD Elements
    const hudEfficiency = document.getElementById('hudEfficiency');
    const hudPlaced = document.getElementById('hudPlaced');
    const hudHoles = document.getElementById('hudHoles');
    const hudSharedCut = document.getElementById('hudSharedCut');
    const hudSheetCount = document.getElementById('hudSheetCount');

    // Auto fit sheet into canvas viewport
    function fitToView() {
        const sw = nester.config.sheetWidth;
        const sh = nester.config.sheetHeight;
        const padding = 40;
        const availableW = canvas.width - padding * 2;
        const availableH = canvas.height - padding * 2;
        if (availableW <= 0 || availableH <= 0) return;
        zoom = Math.min(availableW / sw, availableH / sh, 1.5);
        panX = (canvas.width - sw * zoom) / 2;
        panY = (canvas.height - sh * zoom) / 2;
        draw();
    }

    // Resize Canvas to fit container
    function resizeCanvas() {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        fitToView();
    }
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 80);

    // Pan & Zoom handlers
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.2, Math.min(3.0, zoom * zoomFactor));

        // Zoom relative to mouse
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        panX = mouseX - (mouseX - panX) * (newZoom / zoom);
        panY = mouseY - (mouseY - panY) * (newZoom / zoom);
        zoom = newZoom;
        draw();
    }, { passive: false });

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        draw();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Render Parts List in Left Sidebar
    function renderPartsList() {
        partsListEl.innerHTML = '';
        nester.parts.forEach((part, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'part-item';
            const hasHoles = part.holes && part.holes.length > 0;
            const hollowBadge = hasHoles ? `<span style="color:var(--accent);font-size:10px;font-weight:700;margin-left:4px;">[Hollow]</span>` : '';

            itemEl.innerHTML = `
                <div class="part-preview">
                    <svg width="34" height="34" viewBox="0 0 ${part.bounds.width || 50} ${part.bounds.height || 50}">
                        <polygon points="${part.polygon.map(p => `${p.x},${p.y}`).join(' ')}"
                                 fill="${part.color}" fill-opacity="0.3" stroke="${part.color}" stroke-width="2" />
                    </svg>
                </div>
                <div class="part-info">
                    <div class="part-name">${part.name} ${hollowBadge}</div>
                    <div class="part-meta">${Math.round(part.bounds.width)} × ${Math.round(part.bounds.height)} mm</div>
                </div>
                <div class="quantity-control">
                    <button class="qty-btn" data-action="dec" data-index="${index}">-</button>
                    <span class="qty-val">${part.quantity}</span>
                    <button class="qty-btn" data-action="inc" data-index="${index}">+</button>
                </div>
            `;
            partsListEl.appendChild(itemEl);
        });

        // Add event listeners to qty buttons
        partsListEl.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                const action = btn.dataset.action;
                if (action === 'inc') {
                    nester.parts[idx].quantity++;
                } else if (action === 'dec' && nester.parts[idx].quantity > 0) {
                    nester.parts[idx].quantity--;
                }
                renderPartsList();
            });
        });
    }

    // Canvas Drawing Function
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        // Apply pan and zoom
        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);

        const sw = nester.config.sheetWidth;
        const sh = nester.config.sheetHeight;

        // Draw Sheet Background (0machine Dark Slate)
        ctx.fillStyle = '#0F1219';
        ctx.fillRect(0, 0, sw, sh);

        // Draw Sheet Grid (50mm steps)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= sw; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, sh);
            ctx.stroke();
        }
        for (let y = 0; y <= sh; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(sw, y);
            ctx.stroke();
        }

        // Draw Margin boundary
        const m = nester.config.margin;
        ctx.strokeStyle = 'rgba(254, 119, 51, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(m, m, sw - 2 * m, sh - 2 * m);
        ctx.setLineDash([]);

        // Draw Outer Sheet Boundary with 0machine Orange glow
        ctx.strokeStyle = '#FE7733';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(0, 0, sw, sh);

        // Draw Dimensions Label
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '12px Inter';
        ctx.fillText(`${sw} mm`, sw / 2 - 25, -12);
        ctx.fillText(`${sh} mm`, -45, sh / 2);

        // Draw Placed Parts if available
        if (nester.bestResult && nester.bestResult.sheets.length > 0) {
            const sheet = nester.bestResult.sheets[0]; // Primary sheet
            sheet.placements.forEach((p, idx) => {
                ctx.save();
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.22;

                ctx.beginPath();
                // Outer polygon
                ctx.moveTo(p.polygon[0].x, p.polygon[0].y);
                for (let i = 1; i < p.polygon.length; i++) {
                    ctx.lineTo(p.polygon[i].x, p.polygon[i].y);
                }
                ctx.closePath();

                // Cutout holes
                if (p.polygon.holes && p.polygon.holes.length > 0) {
                    p.polygon.holes.forEach(hole => {
                        ctx.moveTo(hole[0].x, hole[0].y);
                        for (let i = 1; i < hole.length; i++) {
                            ctx.lineTo(hole[i].x, hole[i].y);
                        }
                        ctx.closePath();
                    });
                }
                ctx.fill('evenodd');

                // Glowing outer stroke
                ctx.globalAlpha = 0.95;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(p.polygon[0].x, p.polygon[0].y);
                for (let i = 1; i < p.polygon.length; i++) {
                    ctx.lineTo(p.polygon[i].x, p.polygon[i].y);
                }
                ctx.closePath();
                ctx.stroke();

                // Draw hole outlines with dashed accent line
                if (p.polygon.holes && p.polygon.holes.length > 0) {
                    ctx.save();
                    ctx.strokeStyle = '#FE7733';
                    ctx.lineWidth = 1.2;
                    ctx.setLineDash([3, 3]);
                    p.polygon.holes.forEach(hole => {
                        ctx.beginPath();
                        ctx.moveTo(hole[0].x, hole[0].y);
                        for (let i = 1; i < hole.length; i++) {
                            ctx.lineTo(hole[i].x, hole[i].y);
                        }
                        ctx.closePath();
                        ctx.stroke();
                    });
                    ctx.restore();
                }

                // Part label & index
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '10px Inter';
                const labelText = p.isInsideHole ? `#${idx + 1} ★` : `#${idx + 1}`;
                ctx.fillText(labelText, p.x + 8, p.y + 14);

                ctx.restore();
            });

            // Highlight Common-Line Laser Twin Cuts with glowing cyan stroke
            if (nester.config.commonLine !== false && sheet.sharedSegments && sheet.sharedSegments.length > 0) {
                ctx.save();
                ctx.strokeStyle = '#38BDF8';
                ctx.lineWidth = 3.5;
                ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
                ctx.shadowBlur = 10;
                ctx.lineCap = 'round';
                sheet.sharedSegments.forEach(seg => {
                    ctx.beginPath();
                    ctx.moveTo(seg.p1.x, seg.p1.y);
                    ctx.lineTo(seg.p2.x, seg.p2.y);
                    ctx.stroke();
                });
                ctx.restore();
            }
        }

        ctx.restore();
    }

    // Real-time Devis Quotation Updater
    function updateDevis(currentResult) {
        const result = currentResult || nester.bestResult;
        const materialId = materialSelect ? materialSelect.value : 'steel';
        const thickness = thicknessSelect ? parseFloat(thicknessSelect.value) : 2.0;

        const sheetWidth = nester.config.sheetWidth || 1000;
        const sheetHeight = nester.config.sheetHeight || 600;
        const sheetCount = result && result.sheets ? Math.max(1, result.sheets.length) : 1;
        const totalPlacedArea = result ? (result.totalPlacedArea || 0) : 0;
        const totalPartsCount = result ? (result.totalPlaced || 0) : 0;
        const totalPerimeterMm = result ? (result.totalPerimeterMm || 0) : 0;
        const sharedCutMm = (nester.config.commonLine !== false && result) ? (result.sharedCutMm || 0) : 0;

        const quote = costCalc.calculate({
            materialId,
            thickness,
            sheetWidth,
            sheetHeight,
            sheetCount,
            totalPlacedArea,
            totalPartsCount,
            totalPerimeterMm,
            sharedCutMm
        });

        if (devisSavingsPill) devisSavingsPill.textContent = `Saved: ${quote.savedMoneyMAD} MAD`;
        if (devisWeight) devisWeight.textContent = `${quote.weightKg} kg`;
        if (devisMaterialCost) devisMaterialCost.textContent = `${quote.totalMaterialCostMAD} MAD`;
        if (devisTime) devisTime.textContent = `${quote.cuttingTimeMinutes} min`;
        if (devisMachineCost) devisMachineCost.textContent = `${quote.machiningCostMAD} MAD`;
        if (devisSharedCut) devisSharedCut.textContent = `-${quote.savedMoneyMAD} MAD (${quote.sharedCutMm} mm)`;
        if (devisTotalMAD) devisTotalMAD.innerHTML = `${quote.totalCostMAD} <span style="font-size: 12px; font-weight: 500;">DH</span>`;
        if (devisUnitPart) devisUnitPart.textContent = `${quote.unitPricePerPart} MAD / part`;
    }

    // Real-time Progress Callback
    nester.onProgress = (result, generation) => {
        hudEfficiency.innerHTML = `${result.compactEfficiency}<span>%</span>`;
        hudPlaced.textContent = `${result.totalPlaced} / ${result.totalItems}`;
        if (hudHoles) {
            hudHoles.textContent = result.partsInHoles || 0;
        }
        if (hudSharedCut) {
            hudSharedCut.innerHTML = `${result.sharedCutMm || 0}<span>mm</span>`;
        }
        hudSheetCount.textContent = result.sheets.length;
        updateDevis(result);
        draw();
    };

    // Controls Event Listeners
    spacingSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        spacingVal.textContent = `${val} mm`;
        nester.setConfig({ spacing: val });
    });

    marginSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        marginVal.textContent = `${val} mm`;
        nester.setConfig({ margin: val });
        draw();
    });

    sheetWidthInput.addEventListener('change', (e) => {
        nester.setConfig({ sheetWidth: parseInt(e.target.value) || 1000 });
        fitToView();
        updateDevis();
    });

    sheetHeightInput.addEventListener('change', (e) => {
        nester.setConfig({ sheetHeight: parseInt(e.target.value) || 600 });
        fitToView();
        updateDevis();
    });

    rotationsSelect.addEventListener('change', (e) => {
        nester.setConfig({ rotations: parseInt(e.target.value) || 4 });
    });

    if (useHolesToggle) {
        useHolesToggle.addEventListener('change', (e) => {
            nester.setConfig({ useHoles: e.target.checked });
        });
    }

    if (commonLineToggle) {
        commonLineToggle.addEventListener('change', (e) => {
            nester.setConfig({ commonLine: e.target.checked });
            if (nester.bestResult) {
                updateDevis();
                draw();
            }
        });
    }

    // Tab Switching
    if (tabTelemetryBtn && tabDevisBtn) {
        tabTelemetryBtn.addEventListener('click', () => {
            tabTelemetryBtn.classList.add('active');
            tabDevisBtn.classList.remove('active');
            telemetryTabContent.style.display = 'flex';
            devisTabContent.style.display = 'none';
        });
        tabDevisBtn.addEventListener('click', () => {
            tabDevisBtn.classList.add('active');
            tabTelemetryBtn.classList.remove('active');
            devisTabContent.style.display = 'flex';
            telemetryTabContent.style.display = 'none';
            updateDevis();
        });
    }

    // Material & Thickness Selectors
    if (materialSelect) {
        materialSelect.addEventListener('change', () => updateDevis());
    }
    if (thicknessSelect) {
        thicknessSelect.addEventListener('change', () => updateDevis());
    }

    // Print Official Devis
    if (printDevisBtn) {
        printDevisBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Start / Stop Nesting
    startBtn.addEventListener('click', async () => {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusPill.querySelector('.pulse-dot').classList.add('working');
        statusText.textContent = 'Optimizing Nesting...';

        await nester.startNesting();

        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusPill.querySelector('.pulse-dot').classList.remove('working');
        statusText.textContent = 'Nesting Ready';
    });

    stopBtn.addEventListener('click', () => {
        nester.stopNesting();
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusPill.querySelector('.pulse-dot').classList.remove('working');
        statusText.textContent = 'Paused';
    });

    resetBtn.addEventListener('click', () => {
        nester.stopNesting();
        nester.bestResult = null;
        hudEfficiency.innerHTML = `0<span>%</span>`;
        hudPlaced.textContent = '0 / 0';
        if (hudHoles) hudHoles.textContent = '0';
        if (hudSharedCut) hudSharedCut.innerHTML = `0<span>mm</span>`;
        hudSheetCount.textContent = '1';
        updateDevis(null);
        fitToView();
    });

    // Export SVG
    exportBtn.addEventListener('click', () => {
        const svgContent = nester.exportSVG(0);
        if (!svgContent) {
            alert('Please run nesting before exporting.');
            return;
        }
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `0machine_nest_sheet1_${Date.now()}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // SVG Drag & Drop File Upload
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#FE7733';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'rgba(254, 119, 51, 0.3)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(254, 119, 51, 0.3)';
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    function handleFileUpload(file) {
        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith('.svg') && !lowerName.endsWith('.dxf')) {
            alert('Please upload an SVG or DXF file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            if (lowerName.endsWith('.dxf')) {
                parseAndAddDxf(content, baseName);
            } else {
                parseAndAddSvg(content, baseName);
            }
        };
        reader.readAsText(file);
    }

    function parseAndAddDxf(dxfContent, baseName) {
        const dxfParser = new DxfParser();
        const extracted = dxfParser.parse(dxfContent, baseName);
        if (extracted.length === 0) {
            alert('No closed 2D polylines or contours found in this DXF.');
            return;
        }

        extracted.forEach((p) => {
            const color = colorPalette[nester.parts.length % colorPalette.length];
            nester.addPart({
                name: p.name,
                polygon: p.polygon,
                holes: p.holes || [],
                quantity: 2,
                color: color
            });
        });

        renderPartsList();
        fitToView();
    }

    function parseAndAddSvg(svgContent, baseName) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const paths = doc.querySelectorAll('path, polygon, rect');

        let added = 0;
        paths.forEach((el, i) => {
            let poly = [];
            if (el.tagName.toLowerCase() === 'path') {
                const d = el.getAttribute('d');
                poly = GeometryUtil.svgPathToPolygon(d);
            } else if (el.tagName.toLowerCase() === 'polygon') {
                const pts = el.getAttribute('points').trim().split(/\s+|,/);
                for (let p = 0; p < pts.length; p += 2) {
                    poly.push({ x: parseFloat(pts[p]), y: parseFloat(pts[p + 1]) });
                }
            } else if (el.tagName.toLowerCase() === 'rect') {
                const w = parseFloat(el.getAttribute('width'));
                const h = parseFloat(el.getAttribute('height'));
                poly = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
            }

            if (poly.length >= 3) {
                const color = colorPalette[nester.parts.length % colorPalette.length];
                nester.addPart({
                    name: `${baseName} #${i + 1}`,
                    polygon: poly,
                    quantity: 2,
                    color: color
                });
                added++;
            }
        });

        if (added > 0) {
            renderPartsList();
            fitToView();
        } else {
            alert('No valid 2D shapes found in this SVG.');
        }
    }

    // Load Sample DXF Button
    const loadSampleDxfBtn = document.getElementById('loadSampleDxfBtn');
    if (loadSampleDxfBtn) {
        loadSampleDxfBtn.addEventListener('click', async () => {
            try {
                const [r1, r2] = await Promise.all([
                    fetch('samples/sample_bracket.dxf').then(r => r.text()),
                    fetch('samples/sample_flange.dxf').then(r => r.text())
                ]);
                parseAndAddDxf(r1, 'DXF Bracket');
                parseAndAddDxf(r2, 'DXF Motor Flange');
            } catch (err) {
                console.error('Failed to load sample DXF:', err);
            }
        });
    }

    // ==========================================
    // 0machine LaserAI Studio Controller
    // ==========================================
    const laserAiEngine = new LaserAiEngine();
    let currentLaserPart = null;
    let currentUploadedImage = null;
    let activeAiMode = 'standard';

    const laserAiModal = document.getElementById('laserAiModal');
    const openLaserAiBtn = document.getElementById('openLaserAiBtn');
    const openLaserAiSidebarBtn = document.getElementById('openLaserAiSidebarBtn');
    const closeLaserAiModalBtn = document.getElementById('closeLaserAiModalBtn');

    const tabPromptBtn = document.getElementById('tabPromptBtn');
    const tabTraceBtn = document.getElementById('tabTraceBtn');
    const aiPromptSection = document.getElementById('aiPromptSection');
    const aiTraceSection = document.getElementById('aiTraceSection');

    const aiPromptInput = document.getElementById('aiPromptInput');
    const targetSizeSlider = document.getElementById('targetSizeSlider');
    const targetSizeVal = document.getElementById('targetSizeVal');
    const generateLaserBtn = document.getElementById('generateLaserBtn');

    const tracerDropzone = document.getElementById('tracerDropzone');
    const tracerFileInput = document.getElementById('tracerFileInput');
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdVal = document.getElementById('thresholdVal');
    const smoothingSlider = document.getElementById('smoothingSlider');
    const smoothingVal = document.getElementById('smoothingVal');
    const speckleSlider = document.getElementById('speckleSlider');
    const speckleVal = document.getElementById('speckleVal');
    const invertColorsCheck = document.getElementById('invertColorsCheck');
    const retraceBtn = document.getElementById('retraceBtn');

    const studioPreviewCanvas = document.getElementById('studioPreviewCanvas');
    const studioLoadingOverlay = document.getElementById('studioLoadingOverlay');
    const studioLoadingText = document.getElementById('studioLoadingText');

    const statDim = document.getElementById('statDim');
    const statPerimeter = document.getElementById('statPerimeter');
    const statHoles = document.getElementById('statHoles');
    const statCost = document.getElementById('statCost');

    const addToNestBtn = document.getElementById('addToNestBtn');
    const exportLaserSvgBtn = document.getElementById('exportLaserSvgBtn');
    const exportLaserDxfBtn = document.getElementById('exportLaserDxfBtn');

    // Open/Close Modal
    function openLaserAiModal() {
        if (!laserAiModal) return;
        laserAiModal.classList.add('active');
        if (!currentLaserPart) {
            triggerAiGeneration();
        } else {
            renderStudioPreview(currentLaserPart);
        }
    }

    function closeLaserAiModal() {
        if (!laserAiModal) return;
        laserAiModal.classList.remove('active');
    }

    if (openLaserAiBtn) openLaserAiBtn.addEventListener('click', openLaserAiModal);
    if (openLaserAiSidebarBtn) openLaserAiSidebarBtn.addEventListener('click', openLaserAiModal);
    if (closeLaserAiModalBtn) closeLaserAiModalBtn.addEventListener('click', closeLaserAiModal);

    // Close on escape or outside click
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && laserAiModal && laserAiModal.classList.contains('active')) {
            closeLaserAiModal();
        }
    });

    laserAiModal.addEventListener('click', (e) => {
        if (e.target === laserAiModal) closeLaserAiModal();
    });

    // Tab Navigation
    tabPromptBtn.addEventListener('click', () => {
        tabPromptBtn.classList.add('active');
        tabTraceBtn.classList.remove('active');
        aiPromptSection.style.display = 'flex';
        aiTraceSection.style.display = 'none';
    });

    tabTraceBtn.addEventListener('click', () => {
        tabTraceBtn.classList.add('active');
        tabPromptBtn.classList.remove('active');
        aiPromptSection.style.display = 'none';
        aiTraceSection.style.display = 'flex';
    });

    // Laser Mode Selection
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            activeAiMode = card.getAttribute('data-mode') || 'standard';
            triggerAiGeneration();
        });
    });

    // Preset Pills
    document.querySelectorAll('.preset-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const preset = pill.getAttribute('data-preset');
            if (preset === 'eagle') {
                aiPromptInput.value = 'Imperial eagle woodcut emblem';
                setMode('standard');
            } else if (preset === 'wolf') {
                aiPromptInput.value = 'Geometric wolf head stencil';
                setMode('connected-stencil');
            } else if (preset === 'gear') {
                aiPromptInput.value = 'Precision industrial gear medallion';
                setMode('keychain-medallion');
            } else if (preset === 'plaque') {
                aiPromptInput.value = '0machine lab family sign established 2026';
                setMode('standard');
            } else if (preset === 'mountain') {
                aiPromptInput.value = 'Three peaks mountain layered scene';
                setMode('layered-scene');
            }
            triggerAiGeneration();
        });
    });

    function setMode(modeName) {
        activeAiMode = modeName;
        document.querySelectorAll('.mode-card').forEach(c => {
            if (c.getAttribute('data-mode') === modeName) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }

    // Sliders
    targetSizeSlider.addEventListener('input', () => {
        targetSizeVal.textContent = `${targetSizeSlider.value} mm`;
    });
    targetSizeSlider.addEventListener('change', () => {
        if (currentLaserPart) {
            triggerAiGeneration();
        }
    });

    thresholdSlider.addEventListener('input', () => {
        thresholdVal.textContent = thresholdSlider.value;
    });

    smoothingSlider.addEventListener('input', () => {
        smoothingVal.textContent = smoothingSlider.value;
    });

    speckleSlider.addEventListener('input', () => {
        speckleVal.textContent = `${speckleSlider.value} px`;
    });

    // Image Upload & Tracing
    tracerDropzone.addEventListener('click', () => tracerFileInput.click());
    tracerFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleTracerImage(e.target.files[0]);
        }
    });

    tracerDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        tracerDropzone.style.borderColor = 'var(--accent)';
    });

    tracerDropzone.addEventListener('dragleave', () => {
        tracerDropzone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    });

    tracerDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        tracerDropzone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleTracerImage(e.dataTransfer.files[0]);
        }
    });

    function handleTracerImage(file) {
        currentUploadedImage = file;
        triggerImageTrace();
    }

    if (retraceBtn) {
        retraceBtn.addEventListener('click', () => {
            if (currentUploadedImage) {
                triggerImageTrace();
            } else {
                triggerAiGeneration();
            }
        });
    }

    // AI Generation Runner
    async function triggerAiGeneration() {
        showStudioLoading("Generating Laser CAD vectors...");
        const prompt = aiPromptInput.value || "Imperial eagle woodcut emblem";
        const targetWidth = parseFloat(targetSizeSlider.value) || 120;

        try {
            const result = await laserAiEngine.generateFromPrompt(prompt, activeAiMode, {
                targetWidthMm: targetWidth,
                smoothing: parseFloat(smoothingSlider.value) || 1.5,
                speckleFilter: parseInt(speckleSlider.value) || 12
            });
            currentLaserPart = result;
            renderStudioPreview(result);
        } catch (err) {
            console.error("AI Generation failed:", err);
            alert("Generation failed: " + err.message);
        } finally {
            hideStudioLoading();
        }
    }

    // Image Trace Runner
    async function triggerImageTrace() {
        if (!currentUploadedImage) return;
        showStudioLoading("Extracting vector contours & holes...");
        try {
            const result = await laserAiEngine.traceImage(currentUploadedImage, {
                threshold: parseInt(thresholdSlider.value) || 128,
                smoothing: parseFloat(smoothingSlider.value) || 1.5,
                speckleFilter: parseInt(speckleSlider.value) || 12,
                invert: invertColorsCheck.checked,
                targetWidthMm: parseFloat(targetSizeSlider.value) || 120,
                mode: activeAiMode,
                name: currentUploadedImage.name.replace(/\.[^/.]+$/, "")
            });
            currentLaserPart = result;
            renderStudioPreview(result);
        } catch (err) {
            console.error("Trace failed:", err);
            alert("Trace failed: " + err.message);
        } finally {
            hideStudioLoading();
        }
    }

    if (generateLaserBtn) {
        generateLaserBtn.addEventListener('click', triggerAiGeneration);
    }

    function showStudioLoading(text) {
        if (studioLoadingText) studioLoadingText.textContent = text;
        if (studioLoadingOverlay) studioLoadingOverlay.style.display = 'flex';
    }

    function hideStudioLoading() {
        if (studioLoadingOverlay) studioLoadingOverlay.style.display = 'none';
    }

    // Render CAD Vector Preview
    function renderStudioPreview(part) {
        if (!part || !studioPreviewCanvas) return;
        const ctx = studioPreviewCanvas.getContext('2d');
        const cw = studioPreviewCanvas.width = 600;
        const ch = studioPreviewCanvas.height = 460;

        ctx.clearRect(0, 0, cw, ch);

        // Dark CAD Background
        ctx.fillStyle = '#06070B';
        ctx.fillRect(0, 0, cw, ch);

        // Draw Millimeter Engineering Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const gridStep = 25;
        for (let x = 0; x < cw; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, ch);
            ctx.stroke();
        }
        for (let y = 0; y < ch; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(cw, y);
            ctx.stroke();
        }

        const poly = part.polygon;
        const holes = part.holes || [];
        if (!poly || poly.length < 3) return;

        // Bounding Box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        poly.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const partW = maxX - minX || 1;
        const partH = maxY - minY || 1;

        // Auto-scale with 40px margin
        const margin = 50;
        const scale = Math.min((cw - margin * 2) / partW, (ch - margin * 2) / partH);
        const offsetX = (cw - partW * scale) / 2 - minX * scale;
        const offsetY = (ch - partH * scale) / 2 - minY * scale;

        const toScreen = (p) => ({
            x: p.x * scale + offsetX,
            y: p.y * scale + offsetY
        });

        // 1. Draw Subtle Part Fill (Wood / Steel look)
        ctx.save();
        ctx.beginPath();
        const p0 = toScreen(poly[0]);
        ctx.moveTo(p0.x, p0.y);
        poly.slice(1).forEach(p => {
            const sp = toScreen(p);
            ctx.lineTo(sp.x, sp.y);
        });
        ctx.closePath();

        // Cutout holes in fill using evenodd rule
        holes.forEach(hole => {
            if (hole.length > 2) {
                const hp0 = toScreen(hole[0]);
                ctx.moveTo(hp0.x, hp0.y);
                hole.slice(1).forEach(p => {
                    const sp = toScreen(p);
                    ctx.lineTo(sp.x, sp.y);
                });
                ctx.closePath();
            }
        });

        ctx.fillStyle = 'rgba(254, 119, 51, 0.08)';
        ctx.fill('evenodd');
        ctx.restore();

        // 2. Draw Outer Cut Contour (Neon Laser Red #FF0055)
        ctx.save();
        ctx.shadowColor = 'rgba(255, 0, 85, 0.5)';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#FF0055';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        poly.slice(1).forEach(p => {
            const sp = toScreen(p);
            ctx.lineTo(sp.x, sp.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 3. Draw Internal Cutouts / Holes (Cyan #00D2FF)
        ctx.save();
        ctx.shadowColor = 'rgba(0, 210, 255, 0.4)';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#00D2FF';
        ctx.lineWidth = 1.8;
        holes.forEach(hole => {
            if (hole.length > 2) {
                ctx.beginPath();
                const hp0 = toScreen(hole[0]);
                ctx.moveTo(hp0.x, hp0.y);
                hole.slice(1).forEach(p => {
                    const sp = toScreen(p);
                    ctx.lineTo(sp.x, sp.y);
                });
                ctx.closePath();
                ctx.stroke();
            }
        });
        ctx.restore();

        // 4. Draw CAD Dimension Callouts
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        // Bottom width dimension
        const botY = maxY * scale + offsetY + 20;
        ctx.fillText(`↔ ${part.stats.width} mm`, cw / 2, botY);

        // Left height dimension
        ctx.save();
        ctx.translate(minX * scale + offsetX - 18, ch / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`↕ ${part.stats.height} mm`, 0, 0);
        ctx.restore();

        ctx.restore();

        // Update Telemetry HUD
        if (statDim) statDim.textContent = `${part.stats.width} × ${part.stats.height} mm`;
        if (statPerimeter) statPerimeter.textContent = `${part.stats.cutPerimeterMm} mm`;
        if (statHoles) statHoles.textContent = `${part.stats.holesCount} Cutout${part.stats.holesCount === 1 ? '' : 's'}`;
        if (statCost) statCost.textContent = `${part.stats.estCostMad} MAD`;
    }

    // Add to Active Nesting Inventory
    if (addToNestBtn) {
        addToNestBtn.addEventListener('click', () => {
            if (!currentLaserPart) return;

            const color = colorPalette[nester.parts.length % colorPalette.length];
            nester.addPart({
                name: currentLaserPart.name || 'Laser_AI_Part',
                polygon: currentLaserPart.polygon,
                holes: currentLaserPart.holes || [],
                quantity: 2,
                color: color
            });

            renderPartsList();
            fitToView();
            closeLaserAiModal();

            // Status message
            const statusText = document.getElementById('statusText');
            if (statusText) statusText.textContent = `Added "${currentLaserPart.name}" to Nest!`;
        });
    }

    // Export Laser SVG
    if (exportLaserSvgBtn) {
        exportLaserSvgBtn.addEventListener('click', () => {
            if (!currentLaserPart || !currentLaserPart.svgString) return;
            downloadFile(currentLaserPart.svgString, `${currentLaserPart.name || 'laser_part'}.svg`, 'image/svg+xml');
        });
    }

    // Export CAD DXF
    if (exportLaserDxfBtn) {
        exportLaserDxfBtn.addEventListener('click', () => {
            if (!currentLaserPart || !currentLaserPart.dxfString) return;
            downloadFile(currentLaserPart.dxfString, `${currentLaserPart.name || 'laser_part'}.dxf`, 'application/dxf');
        });
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Initial render
    renderPartsList();
    draw();
});

