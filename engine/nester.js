/**
 * 0machine Auto-Nesting Engine
 * 2D Irregular Polygon Nesting with Heuristic Packing, Kerf Spacing & Genetic Optimization
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./geometry.js'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./geometry.js'));
    } else {
        root.Nester = factory(root.GeometryUtil);
    }
}(typeof self !== 'undefined' ? self : this, function (GeometryUtil) {
    'use strict';

    class Nester {
        constructor(config = {}) {
            this.config = Object.assign({
                sheetWidth: 1000,
                sheetHeight: 600,
                spacing: 4,         // Spacing between parts (Kerf)
                margin: 8,          // Distance from sheet edge
                rotations: 4,       // 1 (0°), 2 (0, 180°), 4 (0, 90, 180, 270), 8 (45° steps)
                stepSize: 8,        // Grid step resolution in mm
                useHoles: true,     // Nest smaller parts inside holes of larger parts
                commonLine: true,   // Detect and optimize shared edge cutting
                maxGenerations: 50, // GA iterations
                populationSize: 8,
                mutationRate: 0.25
            }, config);

            this.parts = [];        // Input parts templates { id, name, polygon, quantity, color }
            this.isNesting = false;
            this.bestResult = null;
            this.currentIteration = 0;
            this.onProgress = null; // Callback for UI updates
        }

        setConfig(newConfig) {
            Object.assign(this.config, newConfig);
        }

        addPart(part) {
            // Normalize polygon to start at (0, 0)
            const normalizedPoly = GeometryUtil.normalizePolygon(part.polygon);
            if (part.holes && part.holes.length > 0) {
                const bounds = GeometryUtil.getBounds(part.polygon);
                normalizedPoly.holes = part.holes.map(hole => hole.map(p => ({
                    x: p.x - bounds.minX,
                    y: p.y - bounds.minY
                })));
            }

            let area = Math.abs(GeometryUtil.polygonArea(normalizedPoly));
            if (normalizedPoly.holes && normalizedPoly.holes.length > 0) {
                normalizedPoly.holes.forEach(h => {
                    area -= Math.abs(GeometryUtil.polygonArea(h));
                });
            }
            const bounds = GeometryUtil.getBounds(normalizedPoly);

            this.parts.push({
                id: part.id || 'part_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: part.name || 'Part ' + (this.parts.length + 1),
                polygon: normalizedPoly,
                holes: normalizedPoly.holes || [],
                area: Math.max(area, 1),
                bounds: bounds,
                quantity: part.quantity || 1,
                color: part.color || '#FE7733'
            });
        }

        clearParts() {
            this.parts = [];
            this.bestResult = null;
        }

        getRotationAngles() {
            const r = this.config.rotations;
            if (r === 1) return [0];
            if (r === 2) return [0, 180];
            if (r === 4) return [0, 90, 180, 270];
            if (r === 8) return [0, 45, 90, 135, 180, 225, 270, 315];
            return [0, 90, 180, 270];
        }

        // Expand input parts into individual instances based on quantity
        expandInstances() {
            const instances = [];
            this.parts.forEach(part => {
                for (let q = 0; q < part.quantity; q++) {
                    instances.push({
                        instanceId: `${part.id}_${q}`,
                        partId: part.id,
                        name: part.name,
                        polygon: part.polygon,
                        holes: part.holes || (part.polygon.holes || []),
                        area: part.area,
                        bounds: part.bounds,
                        color: part.color,
                        rotation: 0
                    });
                }
            });
            return instances;
        }

        // Search for placement inside available holes
        findBestPositionInHoles(sheet, rotationOptions, halfSpacing, stepSize) {
            if (!sheet.availableHoles || sheet.availableHoles.length === 0) return null;

            for (let h = 0; h < sheet.availableHoles.length; h++) {
                const holeObj = sheet.availableHoles[h];
                const holePoly = holeObj.polygon;
                const holeBounds = holeObj.bounds;

                for (let r = 0; r < rotationOptions.length; r++) {
                    const opt = rotationOptions[r];
                    // If part bounds are bigger than hole bounds, it cannot fit
                    if (opt.bounds.width > (holeBounds.width - halfSpacing * 2) || 
                        opt.bounds.height > (holeBounds.height - halfSpacing * 2)) {
                        continue;
                    }

                    const minX = holeBounds.minX + halfSpacing;
                    const maxX = holeBounds.maxX - opt.bounds.width - halfSpacing;
                    const minY = holeBounds.minY + halfSpacing;
                    const maxY = holeBounds.maxY - opt.bounds.height - halfSpacing;

                    if (minX > maxX || minY > maxY) continue;

                    const xStep = Math.max(stepSize, 6);
                    const yStep = Math.max(stepSize, 6);

                    for (let x = minX; x <= maxX; x += xStep) {
                        for (let y = minY; y <= maxY; y += yStep) {
                            const candidatePoly = GeometryUtil.translatePolygon(opt.poly, x, y);

                            // Check 1: Must be completely inside the hole polygon
                            if (!GeometryUtil.isPolygonInsidePolygon(candidatePoly, holePoly)) {
                                continue;
                            }

                            // Check 2: Must not intersect any already nested parts in this hole
                            let collision = false;
                            for (let p = 0; p < holeObj.nestedPlacements.length; p++) {
                                if (GeometryUtil.clipperIntersect(candidatePoly, holeObj.nestedPlacements[p].polygon, 100)) {
                                    collision = true;
                                    break;
                                }
                            }

                            if (!collision) {
                                return {
                                    holeObj: holeObj,
                                    x: x,
                                    y: y,
                                    angle: opt.angle,
                                    bounds: {
                                        minX: x,
                                        minY: y,
                                        maxX: x + opt.bounds.width,
                                        maxY: y + opt.bounds.height
                                    },
                                    finalPolygon: candidatePoly
                                };
                            }
                        }
                    }
                }
            }
            return null;
        }

        // Heuristic Packing for a specific ordering and rotation set
        evaluateSequence(instances) {
            const { sheetWidth, sheetHeight, spacing, margin, stepSize } = this.config;
            const halfSpacing = spacing / 2;
            const allowedRotations = this.getRotationAngles();

            const sheets = [{
                id: 1,
                width: sheetWidth,
                height: sheetHeight,
                placements: [],
                availableHoles: [],
                bounds: { minX: sheetWidth, minY: sheetHeight, maxX: 0, maxY: 0 }
            }];

            let totalPlacedArea = 0;
            let partsInHolesCount = 0;
            const unplaced = [];

            for (let i = 0; i < instances.length; i++) {
                const item = instances[i];
                let placed = false;

                // Precompute rotated polygons for available rotations
                const rotationOptions = allowedRotations.map(angle => {
                    const rotPoly = GeometryUtil.rotatePolygon(item.polygon, angle);
                    const normRotPoly = GeometryUtil.normalizePolygon(rotPoly);
                    const bounds = GeometryUtil.getBounds(normRotPoly);
                    return {
                        angle: angle,
                        poly: normRotPoly,
                        bounds: bounds
                    };
                });

                // Priority 1: Check if this item fits into any available hole on existing sheets!
                if (this.config.useHoles !== false) {
                    for (let s = 0; s < sheets.length; s++) {
                        const sheet = sheets[s];
                        const holePlacement = this.findBestPositionInHoles(sheet, rotationOptions, halfSpacing, stepSize);
                        if (holePlacement) {
                            holePlacement.holeObj.nestedPlacements.push({
                                polygon: holePlacement.finalPolygon
                            });

                            sheet.placements.push({
                                instanceId: item.instanceId,
                                partId: item.partId,
                                name: item.name,
                                color: item.color,
                                polygon: holePlacement.finalPolygon,
                                rotation: holePlacement.angle,
                                x: holePlacement.x,
                                y: holePlacement.y,
                                area: item.area,
                                bounds: holePlacement.bounds,
                                isInsideHole: true,
                                parentPartId: holePlacement.holeObj.parentPartId
                            });

                            totalPlacedArea += item.area;
                            partsInHolesCount++;
                            placed = true;
                            break;
                        }
                    }
                }

                // Priority 2: If not placed in a hole, try regular sheet placement
                if (!placed) {
                    for (let s = 0; s < sheets.length; s++) {
                        const sheet = sheets[s];
                        const bestPlacement = this.findBestPositionOnSheet(sheet, rotationOptions, margin, halfSpacing, stepSize);

                        if (bestPlacement) {
                            sheet.placements.push({
                                instanceId: item.instanceId,
                                partId: item.partId,
                                name: item.name,
                                color: item.color,
                                polygon: bestPlacement.finalPolygon,
                                rotation: bestPlacement.angle,
                                x: bestPlacement.x,
                                y: bestPlacement.y,
                                area: item.area,
                                bounds: bestPlacement.bounds,
                                isInsideHole: false
                            });

                            // If this placed part has holes, register them as available sub-bins!
                            if (bestPlacement.finalPolygon.holes && bestPlacement.finalPolygon.holes.length > 0) {
                                bestPlacement.finalPolygon.holes.forEach((hPoly, idx) => {
                                    sheet.availableHoles.push({
                                        parentInstanceId: item.instanceId,
                                        parentPartId: item.partId,
                                        holeIndex: idx,
                                        polygon: hPoly,
                                        bounds: GeometryUtil.getBounds(hPoly),
                                        nestedPlacements: []
                                    });
                                });
                            }

                            // Update sheet bounding box
                            sheet.bounds.minX = Math.min(sheet.bounds.minX, bestPlacement.bounds.minX);
                            sheet.bounds.minY = Math.min(sheet.bounds.minY, bestPlacement.bounds.minY);
                            sheet.bounds.maxX = Math.max(sheet.bounds.maxX, bestPlacement.bounds.maxX);
                            sheet.bounds.maxY = Math.max(sheet.bounds.maxY, bestPlacement.bounds.maxY);

                            totalPlacedArea += item.area;
                            placed = true;
                            break;
                        }
                    }
                }

                // Priority 3: If not placed in existing sheets, try a new sheet
                if (!placed) {
                    const newSheet = {
                        id: sheets.length + 1,
                        width: sheetWidth,
                        height: sheetHeight,
                        placements: [],
                        availableHoles: [],
                        bounds: { minX: sheetWidth, minY: sheetHeight, maxX: 0, maxY: 0 }
                    };
                    const bestPlacement = this.findBestPositionOnSheet(newSheet, rotationOptions, margin, halfSpacing, stepSize);

                    if (bestPlacement) {
                        newSheet.placements.push({
                            instanceId: item.instanceId,
                            partId: item.partId,
                            name: item.name,
                            color: item.color,
                            polygon: bestPlacement.finalPolygon,
                            rotation: bestPlacement.angle,
                            x: bestPlacement.x,
                            y: bestPlacement.y,
                            area: item.area,
                            bounds: bestPlacement.bounds,
                            isInsideHole: false
                        });

                        if (bestPlacement.finalPolygon.holes && bestPlacement.finalPolygon.holes.length > 0) {
                            bestPlacement.finalPolygon.holes.forEach((hPoly, idx) => {
                                newSheet.availableHoles.push({
                                    parentInstanceId: item.instanceId,
                                    parentPartId: item.partId,
                                    holeIndex: idx,
                                    polygon: hPoly,
                                    bounds: GeometryUtil.getBounds(hPoly),
                                    nestedPlacements: []
                                });
                            });
                        }

                        newSheet.bounds.minX = bestPlacement.bounds.minX;
                        newSheet.bounds.minY = bestPlacement.bounds.minY;
                        newSheet.bounds.maxX = bestPlacement.bounds.maxX;
                        newSheet.bounds.maxY = bestPlacement.bounds.maxY;

                        sheets.push(newSheet);
                        totalPlacedArea += item.area;
                        placed = true;
                    } else {
                        unplaced.push(item);
                    }
                }
            }

            // Calculate overall efficiency & cutting perimeters
            let totalUsedSheetArea = 0;
            let totalPerimeterMm = 0;
            let totalSharedMm = 0;
            const allSharedSegments = [];
            const edgeTolerance = Math.max(spacing * 1.25, 2.5);

            sheets.forEach(sheet => {
                sheet.sharedSegments = [];
                if (sheet.placements.length > 0) {
                    const w = Math.max(0, sheet.bounds.maxX - sheet.bounds.minX);
                    const h = Math.max(0, sheet.bounds.maxY - sheet.bounds.minY);
                    totalUsedSheetArea += Math.max(w * h, 1);

                    const pls = sheet.placements;
                    for (let i = 0; i < pls.length; i++) {
                        totalPerimeterMm += GeometryUtil.polygonPerimeter(pls[i].polygon);

                        // Check shared edges with other parts on same sheet if commonLine enabled
                        if (this.config.commonLine !== false) {
                            for (let j = i + 1; j < pls.length; j++) {
                                const segs = GeometryUtil.findSharedSegments(pls[i].polygon, pls[j].polygon, edgeTolerance);
                                segs.forEach(s => {
                                    totalSharedMm += s.length;
                                    sheet.sharedSegments.push(s);
                                    allSharedSegments.push(s);
                                });
                            }
                        }
                    }
                }
            });

            const sheetCapacity = sheets.length * (sheetWidth * sheetHeight);
            const globalEfficiency = sheetCapacity > 0 ? (totalPlacedArea / sheetCapacity) * 100 : 0;
            const compactEfficiency = totalUsedSheetArea > 0 ? (totalPlacedArea / totalUsedSheetArea) * 100 : 0;

            return {
                sheets: sheets,
                totalPlaced: instances.length - unplaced.length,
                totalItems: instances.length,
                partsInHoles: partsInHolesCount,
                unplaced: unplaced,
                totalPlacedArea: totalPlacedArea,
                totalPerimeterMm: Math.round(totalPerimeterMm),
                sharedCutMm: Math.round(totalSharedMm),
                sharedSegments: allSharedSegments,
                sheetCapacity: sheetCapacity,
                globalEfficiency: Math.min(100, Number(globalEfficiency.toFixed(2))),
                compactEfficiency: Math.min(100, Number(compactEfficiency.toFixed(2)))
            };
        }

        // Search for the optimal bottom-left coordinate
        findBestPositionOnSheet(sheet, rotationOptions, margin, halfSpacing, stepSize) {
            const { width, height, placements } = sheet;
            let bestCandidate = null;
            let minScore = Infinity;

            for (let r = 0; r < rotationOptions.length; r++) {
                const opt = rotationOptions[r];
                const pWidth = opt.bounds.width;
                const pHeight = opt.bounds.height;

                const maxX = width - margin - pWidth;
                const maxY = height - margin - pHeight;

                if (maxX < margin || maxY < margin) continue;

                // Generate candidate X coordinates (origin + contact points of placed parts)
                const candidateXs = new Set([margin]);
                const candidateYs = new Set([margin]);

                placements.forEach(placed => {
                    const rightEdge = placed.bounds.maxX + halfSpacing * 2;
                    const topEdge = placed.bounds.maxY + halfSpacing * 2;
                    if (rightEdge <= maxX) candidateXs.add(Math.round(rightEdge));
                    if (topEdge <= maxY) candidateYs.add(Math.round(topEdge));
                });

                // Also add regular grid steps to prevent getting trapped in local minima
                const xStep = Math.max(stepSize, 10);
                const yStep = Math.max(stepSize, 10);

                for (let x = margin; x <= maxX; x += xStep * 2) candidateXs.add(x);
                for (let y = margin; y <= maxY; y += yStep * 2) candidateYs.add(y);

                const sortedXs = Array.from(candidateXs).sort((a, b) => a - b);
                const sortedYs = Array.from(candidateYs).sort((a, b) => a - b);

                for (let xi = 0; xi < sortedXs.length; xi++) {
                    const x = sortedXs[xi];
                    if (x > maxX) break;

                    for (let yi = 0; yi < sortedYs.length; yi++) {
                        const y = sortedYs[yi];
                        if (y > maxY) break;

                        // Gravity score: heavily prioritize bottom-left placement
                        const score = (x * 2.5) + (y * 1.0);
                        if (score >= minScore) continue;

                        const candidateBounds = {
                            minX: x - halfSpacing,
                            minY: y - halfSpacing,
                            maxX: x + pWidth + halfSpacing,
                            maxY: y + pHeight + halfSpacing
                        };

                        // Fast AABB Collision Pre-check with already placed items
                        let collision = false;
                        for (let p = 0; p < placements.length; p++) {
                            const pb = placements[p].bounds;
                            if (!(candidateBounds.maxX < pb.minX ||
                                candidateBounds.minX > pb.maxX ||
                                candidateBounds.maxY < pb.minY ||
                                candidateBounds.minY > pb.maxY)) {
                                
                                // AABB overlaps: Perform exact polygon intersection
                                const transPoly = GeometryUtil.translatePolygon(opt.poly, x, y);
                                if (GeometryUtil.clipperIntersect(transPoly, placements[p].polygon, 100)) {
                                    collision = true;
                                    break;
                                }
                            }
                        }

                        if (!collision) {
                            minScore = score;
                            const finalPoly = GeometryUtil.translatePolygon(opt.poly, x, y);
                            bestCandidate = {
                                x: x,
                                y: y,
                                angle: opt.angle,
                                bounds: {
                                    minX: x,
                                    minY: y,
                                    maxX: x + pWidth,
                                    maxY: y + pHeight
                                },
                                finalPolygon: finalPoly
                            };
                            break; // Greedy step for this X
                        }
                    }
                }
            }

            return bestCandidate;
        }

        // Run full optimization loop
        async startNesting() {
            this.isNesting = true;
            this.currentIteration = 0;
            const startTime = performance.now();

            let instances = this.expandInstances();
            if (instances.length === 0) {
                this.isNesting = false;
                return null;
            }

            // 1. Initial Greedy Solution: Sort by area descending (largest parts first)
            instances.sort((a, b) => b.area - a.area);
            let bestResult = this.evaluateSequence(instances);
            bestResult.durationMs = Math.round(performance.now() - startTime);
            this.bestResult = bestResult;

            if (this.onProgress) {
                this.onProgress(bestResult, 0);
            }

            // 2. Iterative Optimization (Simulated Annealing / Genetic Permutation)
            while (this.isNesting && this.currentIteration < this.config.maxGenerations) {
                this.currentIteration++;

                // Clone and mutate instance sequence
                const mutated = instances.slice(0);
                if (Math.random() < this.config.mutationRate) {
                    // Swap two random elements
                    const idx1 = Math.floor(Math.random() * mutated.length);
                    const idx2 = Math.floor(Math.random() * mutated.length);
                    const temp = mutated[idx1];
                    mutated[idx1] = mutated[idx2];
                    mutated[idx2] = temp;
                } else {
                    // Small local shift
                    const idx = Math.floor(Math.random() * (mutated.length - 1));
                    const item = mutated.splice(idx, 1)[0];
                    mutated.splice(idx + 1, 0, item);
                }

                const candidate = this.evaluateSequence(mutated);

                // Higher placed count OR better efficiency on same sheet count
                const isBetter = (candidate.totalPlaced > bestResult.totalPlaced) ||
                    (candidate.totalPlaced === bestResult.totalPlaced &&
                     candidate.sheets.length < bestResult.sheets.length) ||
                    (candidate.totalPlaced === bestResult.totalPlaced &&
                     candidate.sheets.length === bestResult.sheets.length &&
                     candidate.compactEfficiency > bestResult.compactEfficiency);

                if (isBetter) {
                    instances = mutated;
                    bestResult = candidate;
                    bestResult.durationMs = Math.round(performance.now() - startTime);
                    this.bestResult = bestResult;
                }

                if (this.onProgress) {
                    this.onProgress(this.bestResult, this.currentIteration);
                }

                // Yield to event loop to keep UI 60fps responsive
                await new Promise(r => setTimeout(r, 20));
            }

            this.isNesting = false;
            return this.bestResult;
        }

        stopNesting() {
            this.isNesting = false;
        }

        // Export result as clean Production SVG
        exportSVG(sheetIndex = 0) {
            if (!this.bestResult || !this.bestResult.sheets[sheetIndex]) return null;
            const sheet = this.bestResult.sheets[sheetIndex];
            const { width, height, placements } = sheet;

            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}mm" height="${height}mm">\n`;
            svg += `  <!-- 0machine Nesting Engine Export: Sheet ${sheet.id} -->\n`;
            svg += `  <rect x="0" y="0" width="${width}" height="${height}" fill="#0A0C12" stroke="#FE7733" stroke-width="1.5" />\n`;

            placements.forEach(p => {
                svg += `  <g id="${p.instanceId}" data-part="${p.partId}" data-in-hole="${!!p.isInsideHole}">\n`;
                if (p.polygon.holes && p.polygon.holes.length > 0) {
                    let d = `M ` + p.polygon.map(pt => `${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' L ') + ` Z `;
                    p.polygon.holes.forEach(hole => {
                        d += `M ` + hole.map(pt => `${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' L ') + ` Z `;
                    });
                    svg += `    <path d="${d}" fill-rule="evenodd" fill="${p.color}" fill-opacity="0.25" stroke="${p.color}" stroke-width="1.2" />\n`;
                } else {
                    const pointsStr = p.polygon.map(pt => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ');
                    svg += `    <polygon points="${pointsStr}" fill="${p.color}" fill-opacity="0.25" stroke="${p.color}" stroke-width="1.2" />\n`;
                }
                svg += `  </g>\n`;
            });

            if (sheet.sharedSegments && sheet.sharedSegments.length > 0) {
                svg += `  <!-- 0machine Common-Line Laser Twin Cuts -->\n`;
                svg += `  <g id="common-line-cuts" stroke="#38BDF8" stroke-width="1.8">\n`;
                sheet.sharedSegments.forEach(seg => {
                    svg += `    <line x1="${seg.p1.x.toFixed(2)}" y1="${seg.p1.y.toFixed(2)}" x2="${seg.p2.x.toFixed(2)}" y2="${seg.p2.y.toFixed(2)}" />\n`;
                });
                svg += `  </g>\n`;
            }

            svg += `</svg>`;
            return svg;
        }
    }

    return Nester;
}));
