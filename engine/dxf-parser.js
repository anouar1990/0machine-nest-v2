/**
 * 0machine Client-Side DXF Parser
 * Robust ASCII DXF Parser for CAD/CAM: LWPOLYLINE, POLYLINE, CIRCLE, LINE, and ARC.
 * Automatically stitches lines and separates outer boundaries from internal holes.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./geometry.js'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./geometry.js'));
    } else {
        root.DxfParser = factory(root.GeometryUtil);
    }
}(typeof self !== 'undefined' ? self : this, function (GeometryUtil) {
    'use strict';

    class DxfParser {
        constructor() {}

        /**
         * Parse DXF text content and extract 2D cutting parts
         * @param {string} dxfText - Raw DXF file text
         * @returns {Array} Array of parts with { name, polygon, holes }
         */
        parse(dxfText, filename = 'Part') {
            const lines = dxfText.replace(/\r\n/g, '\n').split('\n');
            const entities = this.extractEntities(lines);
            const closedLoops = [];

            // 1. Process LWPOLYLINE
            entities.lwpolylines.forEach(poly => {
                const points = this.processLwpolyline(poly);
                if (points.length >= 3) {
                    closedLoops.push(points);
                }
            });

            // 2. Process POLYLINE
            entities.polylines.forEach(poly => {
                const points = this.processPolyline(poly);
                if (points.length >= 3) {
                    closedLoops.push(points);
                }
            });

            // 3. Process CIRCLES
            entities.circles.forEach(circle => {
                const points = this.processCircle(circle);
                if (points.length >= 3) {
                    closedLoops.push(points);
                }
            });

            // 4. Stitch contiguous LINE segments into closed loops
            if (entities.lines.length > 0) {
                const stitched = this.stitchLines(entities.lines);
                stitched.forEach(loop => {
                    if (loop.length >= 3) {
                        closedLoops.push(loop);
                    }
                });
            }

            if (closedLoops.length === 0) {
                return [];
            }

            // Group loops into hierarchical parts (Outer contour vs Holes)
            return this.structureParts(closedLoops, filename);
        }

        /**
         * Extract raw entity records from DXF lines
         */
        extractEntities(lines) {
            const entities = {
                lwpolylines: [],
                polylines: [],
                circles: [],
                lines: [],
                arcs: []
            };

            let inEntities = false;
            let currentEntity = null;
            let currentType = null;

            for (let i = 0; i < lines.length - 1; i += 2) {
                const code = parseInt(lines[i].trim(), 10);
                const value = lines[i + 1].trim();

                if (code === 0) {
                    if (value === 'SECTION' && lines[i + 3] && lines[i + 3].trim() === 'ENTITIES') {
                        inEntities = true;
                        i += 2;
                        continue;
                    }
                    if (value === 'ENDSEC') {
                        inEntities = false;
                        if (currentEntity) this.saveEntity(entities, currentType, currentEntity);
                        currentEntity = null;
                        currentType = null;
                        continue;
                    }

                    if (inEntities) {
                        if (currentEntity) {
                            this.saveEntity(entities, currentType, currentEntity);
                        }
                        currentType = value;
                        currentEntity = { type: value, codes: [] };
                    }
                } else if (inEntities && currentEntity) {
                    currentEntity.codes.push({ code, value });
                }
            }

            if (currentEntity) {
                this.saveEntity(entities, currentType, currentEntity);
            }

            return entities;
        }

        saveEntity(entities, type, entity) {
            if (type === 'LWPOLYLINE') entities.lwpolylines.push(entity);
            else if (type === 'POLYLINE') entities.polylines.push(entity);
            else if (type === 'CIRCLE') entities.circles.push(entity);
            else if (type === 'LINE') entities.lines.push(entity);
            else if (type === 'ARC') entities.arcs.push(entity);
        }

        /**
         * Convert LWPOLYLINE codes to 2D polygon vertices
         */
        processLwpolyline(entity) {
            const points = [];
            let currentVertex = null;
            let isClosed = false;

            entity.codes.forEach(({ code, value }) => {
                if (code === 70) {
                    // Bit 1 = closed polyline
                    isClosed = (parseInt(value, 10) & 1) === 1;
                } else if (code === 10) {
                    // New vertex X
                    if (currentVertex && currentVertex.x !== undefined && currentVertex.y !== undefined) {
                        points.push(currentVertex);
                    }
                    currentVertex = { x: parseFloat(value), bulge: 0 };
                } else if (code === 20 && currentVertex) {
                    currentVertex.y = parseFloat(value);
                } else if (code === 42 && currentVertex) {
                    currentVertex.bulge = parseFloat(value);
                }
            });

            if (currentVertex && currentVertex.x !== undefined && currentVertex.y !== undefined) {
                points.push(currentVertex);
            }

            // Expand bulge arcs if present
            const expanded = [];
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                expanded.push({ x: p1.x, y: p1.y });

                if (p1.bulge && Math.abs(p1.bulge) > 1e-4) {
                    const arcPoints = this.interpolateBulge(p1, p2, p1.bulge);
                    arcPoints.forEach(pt => expanded.push(pt));
                }
            }

            return expanded;
        }

        /**
         * Convert 2D CIRCLE to polygon
         */
        processCircle(entity, steps = 36) {
            let cx = 0, cy = 0, r = 0;
            entity.codes.forEach(({ code, value }) => {
                if (code === 10) cx = parseFloat(value);
                if (code === 20) cy = parseFloat(value);
                if (code === 40) r = parseFloat(value);
            });

            if (r <= 0) return [];
            const points = [];
            for (let i = 0; i < steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                points.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }
            return points;
        }

        /**
         * Convert POLYLINE entity
         */
        processPolyline(entity) {
            const points = [];
            let currentVertex = null;

            entity.codes.forEach(({ code, value }) => {
                if (code === 10) {
                    if (currentVertex && currentVertex.x !== undefined && currentVertex.y !== undefined) {
                        points.push(currentVertex);
                    }
                    currentVertex = { x: parseFloat(value) };
                } else if (code === 20 && currentVertex) {
                    currentVertex.y = parseFloat(value);
                }
            });

            if (currentVertex && currentVertex.x !== undefined && currentVertex.y !== undefined) {
                points.push(currentVertex);
            }
            return points;
        }

        /**
         * Stitch contiguous lines into closed polygon chains
         */
        stitchLines(lineEntities, tolerance = 0.1) {
            const segments = lineEntities.map(entity => {
                let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
                entity.codes.forEach(({ code, value }) => {
                    if (code === 10) x1 = parseFloat(value);
                    if (code === 20) y1 = parseFloat(value);
                    if (code === 11) x2 = parseFloat(value);
                    if (code === 21) y2 = parseFloat(value);
                });
                return { p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } };
            });

            const loops = [];
            const used = new Set();

            for (let i = 0; i < segments.length; i++) {
                if (used.has(i)) continue;
                used.add(i);

                const currentLoop = [segments[i].p1, segments[i].p2];
                let foundMatch = true;

                while (foundMatch) {
                    foundMatch = false;
                    const endPt = currentLoop[currentLoop.length - 1];

                    for (let j = 0; j < segments.length; j++) {
                        if (used.has(j)) continue;
                        const seg = segments[j];

                        if (Math.hypot(endPt.x - seg.p1.x, endPt.y - seg.p1.y) < tolerance) {
                            currentLoop.push(seg.p2);
                            used.add(j);
                            foundMatch = true;
                            break;
                        } else if (Math.hypot(endPt.x - seg.p2.x, endPt.y - seg.p2.y) < tolerance) {
                            currentLoop.push(seg.p1);
                            used.add(j);
                            foundMatch = true;
                            break;
                        }
                    }
                }

                // Check if loop is closed
                if (currentLoop.length >= 3) {
                    const first = currentLoop[0];
                    const last = currentLoop[currentLoop.length - 1];
                    if (Math.hypot(last.x - first.x, last.y - first.y) < tolerance * 2) {
                        currentLoop.pop(); // Remove duplicate closing vertex
                        loops.push(currentLoop);
                    }
                }
            }

            return loops;
        }

        /**
         * Interpolate intermediate points for bulge arc segments
         */
        interpolateBulge(p1, p2, bulge, maxSteps = 12) {
            const theta = 4 * Math.atan(bulge);
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist < 1e-4) return [];

            const radius = Math.abs(dist / (2 * Math.sin(theta / 2)));
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const sagitta = (dist / 2) * Math.abs(bulge);
            const normal = {
                x: -(p2.y - p1.y) / dist,
                y: (p2.x - p1.x) / dist
            };

            const sign = bulge > 0 ? 1 : -1;
            const h = (radius - sagitta) * sign;
            const center = {
                x: mid.x - normal.x * h,
                y: mid.y - normal.y * h
            };

            let startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
            let endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

            if (bulge > 0 && endAngle < startAngle) endAngle += Math.PI * 2;
            if (bulge < 0 && endAngle > startAngle) endAngle -= Math.PI * 2;

            const steps = Math.min(maxSteps, Math.max(4, Math.ceil(Math.abs(theta) / (Math.PI / 8))));
            const points = [];

            for (let s = 1; s < steps; s++) {
                const a = startAngle + (endAngle - startAngle) * (s / steps);
                points.push({
                    x: center.x + radius * Math.cos(a),
                    y: center.y + radius * Math.sin(a)
                });
            }

            return points;
        }

        /**
         * Group closed loops into Outer contours and Inner Holes
         */
        structureParts(loops, baseName) {
            // Calculate absolute areas
            const classified = loops.map(loop => {
                const area = Math.abs(GeometryUtil.polygonArea(loop));
                const bounds = GeometryUtil.getBounds(loop);
                return {
                    polygon: loop,
                    area: area,
                    bounds: bounds,
                    isHole: false,
                    parentIndex: -1
                };
            });

            // Sort by area descending (largest = outer borders)
            classified.sort((a, b) => b.area - a.area);

            const parts = [];
            const assignedHoles = new Set();

            for (let i = 0; i < classified.length; i++) {
                if (assignedHoles.has(i)) continue;

                const outer = classified[i];
                const holes = [];

                // Find any loops completely inside this outer contour
                for (let j = i + 1; j < classified.length; j++) {
                    if (assignedHoles.has(j)) continue;
                    const candidate = classified[j];

                    if (GeometryUtil.isPolygonInsidePolygon(candidate.polygon, outer.polygon)) {
                        holes.push(candidate.polygon);
                        assignedHoles.add(j);
                    }
                }

                parts.push({
                    name: `${baseName} ${parts.length + 1}`,
                    polygon: outer.polygon,
                    holes: holes,
                    quantity: 2
                });
            }

            return parts;
        }
    }

    return DxfParser;
}));
