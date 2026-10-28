/**
 * 0machine Geometry Utilities
 * High-performance 2D Polygon math, SAT Collision, Offsetting, and SVG Conversion
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.GeometryUtil = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const GeometryUtil = {
        TOLERANCE: 1e-6,

        almostEqual: function (a, b, tol) {
            tol = tol || this.TOLERANCE;
            return Math.abs(a - b) < tol;
        },

        degreesToRadians: function (deg) {
            return deg * (Math.PI / 180);
        },

        radiansToDegrees: function (rad) {
            return rad * (180 / Math.PI);
        },

        polygonArea: function (polygon) {
            if (!polygon || polygon.length < 3) return 0;
            let area = 0;
            const n = polygon.length;
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                area += polygon[i].x * polygon[j].y;
                area -= polygon[j].x * polygon[i].y;
            }
            return area * 0.5;
        },

        getBounds: function (polygon) {
            if (!polygon || polygon.length === 0) {
                return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
            }
            let minX = polygon[0].x;
            let maxX = polygon[0].x;
            let minY = polygon[0].y;
            let maxY = polygon[0].y;

            for (let i = 1; i < polygon.length; i++) {
                const pt = polygon[i];
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
            }

            return {
                minX: minX,
                minY: minY,
                maxX: maxX,
                maxY: maxY,
                width: maxX - minX,
                height: maxY - minY
            };
        },

        normalizePolygon: function (polygon) {
            const bounds = this.getBounds(polygon);
            const res = polygon.map(p => ({
                x: p.x - bounds.minX,
                y: p.y - bounds.minY
            }));
            if (polygon.holes && polygon.holes.length > 0) {
                res.holes = polygon.holes.map(hole => hole.map(p => ({
                    x: p.x - bounds.minX,
                    y: p.y - bounds.minY
                })));
            }
            return res;
        },

        rotatePolygon: function (polygon, degrees, center) {
            let res;
            if (degrees === 0 || degrees % 360 === 0) {
                res = polygon.map(p => ({ x: p.x, y: p.y }));
                if (polygon.holes) {
                    res.holes = polygon.holes.map(hole => hole.map(p => ({ x: p.x, y: p.y })));
                }
                return res;
            }
            const rad = this.degreesToRadians(degrees);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            let cx = 0, cy = 0;
            if (center) {
                cx = center.x;
                cy = center.y;
            } else {
                const bounds = this.getBounds(polygon);
                cx = bounds.minX + bounds.width / 2;
                cy = bounds.minY + bounds.height / 2;
            }

            const rotPt = (p) => {
                const dx = p.x - cx;
                const dy = p.y - cy;
                return {
                    x: cx + (dx * cos - dy * sin),
                    y: cy + (dx * sin + dy * cos)
                };
            };

            res = polygon.map(rotPt);
            if (polygon.holes && polygon.holes.length > 0) {
                res.holes = polygon.holes.map(hole => hole.map(rotPt));
            }
            return res;
        },

        translatePolygon: function (polygon, dx, dy) {
            const res = polygon.map(p => ({ x: p.x + dx, y: p.y + dy }));
            if (polygon.holes && polygon.holes.length > 0) {
                res.holes = polygon.holes.map(hole => hole.map(p => ({ x: p.x + dx, y: p.y + dy })));
            }
            return res;
        },

        // Check if innerPoly is completely inside outerPoly
        isPolygonInsidePolygon: function (innerPoly, outerPoly, scale = 1000) {
            if (typeof ClipperLib === 'undefined') {
                for (let i = 0; i < innerPoly.length; i++) {
                    if (!this.pointInPolygon(innerPoly[i], outerPoly)) return false;
                }
                return true;
            }
            const pathInner = innerPoly.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
            const pathOuter = outerPoly.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));

            const clipper = new ClipperLib.Clipper();
            // Difference: pathInner - pathOuter
            clipper.AddPath(pathInner, ClipperLib.PolyType.ptSubject, true);
            clipper.AddPath(pathOuter, ClipperLib.PolyType.ptClip, true);

            const solution = new ClipperLib.Paths();
            clipper.Execute(ClipperLib.ClipType.ctDifference, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

            // If the difference is empty or negligible area, then innerPoly is 100% inside outerPoly!
            if (solution.length === 0) return true;
            let outsideArea = 0;
            for (let i = 0; i < solution.length; i++) {
                outsideArea += Math.abs(ClipperLib.Clipper.Area(solution[i]));
            }
            return (outsideArea / (scale * scale)) < 0.2;
        },

        pointInPolygon: function (point, polygon) {
            let inside = false;
            const n = polygon.length;
            for (let i = 0, j = n - 1; i < n; j = i++) {
                const xi = polygon[i].x, yi = polygon[i].y;
                const xj = polygon[j].x, yj = polygon[j].y;
                const intersect = ((yi > point.y) !== (yj > point.y)) &&
                    (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        },

        // Separating Axis Theorem (SAT) for fast convex or near-convex collision test
        satIntersect: function (polyA, polyB) {
            const polygons = [polyA, polyB];
            for (let i = 0; i < polygons.length; i++) {
                const polygon = polygons[i];
                for (let i1 = 0; i1 < polygon.length; i1++) {
                    const i2 = (i1 + 1) % polygon.length;
                    const p1 = polygon[i1];
                    const p2 = polygon[i2];

                    // Perpendicular normal vector
                    const normal = { x: p2.y - p1.y, y: p1.x - p2.x };

                    let minA = Infinity, maxA = -Infinity;
                    for (let j = 0; j < polyA.length; j++) {
                        const projected = normal.x * polyA[j].x + normal.y * polyA[j].y;
                        if (projected < minA) minA = projected;
                        if (projected > maxA) maxA = projected;
                    }

                    let minB = Infinity, maxB = -Infinity;
                    for (let j = 0; j < polyB.length; j++) {
                        const projected = normal.x * polyB[j].x + normal.y * polyB[j].y;
                        if (projected < minB) minB = projected;
                        if (projected > maxB) maxB = projected;
                    }

                    if (maxA < minB || maxB < minA) {
                        return false; // Separating axis found!
                    }
                }
            }
            return true; // No separating axis -> overlap
        },

        // Exact collision test using ClipperLib boolean intersection
        clipperIntersect: function (polyA, polyB, scale = 1000) {
            if (typeof ClipperLib === 'undefined') {
                return this.satIntersect(polyA, polyB);
            }
            const pathA = polyA.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
            const pathB = polyB.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));

            const clipper = new ClipperLib.Clipper();
            clipper.AddPath(pathA, ClipperLib.PolyType.ptSubject, true);
            clipper.AddPath(pathB, ClipperLib.PolyType.ptClip, true);

            const solution = new ClipperLib.Paths();
            clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

            if (solution.length === 0) return false;
            for (let i = 0; i < solution.length; i++) {
                const area = Math.abs(ClipperLib.Clipper.Area(solution[i]));
                if (area > 1.0) return true; // Non-trivial overlap
            }
            return false;
        },

        // Offset polygon using ClipperLib for kerf / spacing
        offsetPolygon: function (polygon, delta, scale = 1000) {
            if (typeof ClipperLib === 'undefined' || Math.abs(delta) < 1e-4) {
                return [polygon];
            }
            const path = polygon.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
            const co = new ClipperLib.ClipperOffset();
            co.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
            const solution = new ClipperLib.Paths();
            co.Execute(solution, delta * scale);

            const result = [];
            for (let i = 0; i < solution.length; i++) {
                result.push(solution[i].map(pt => ({ x: pt.X / scale, y: pt.Y / scale })));
            }
            return result.length > 0 ? result : [polygon];
        },

        // Approximate SVG path commands to polygon points
        svgPathToPolygon: function (d, samplesPerCurve = 16) {
            if (!d) return [];
            const canvas = document.createElement('canvas');
            const svgDoc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', d);
            svgDoc.appendChild(pathEl);
            document.body.appendChild(svgDoc);

            const totalLength = pathEl.getTotalLength ? pathEl.getTotalLength() : 0;
            const points = [];

            if (totalLength > 0) {
                const numSteps = Math.max(20, Math.min(200, Math.floor(totalLength / 5)));
                for (let i = 0; i <= numSteps; i++) {
                    const pt = pathEl.getPointAtLength((i / numSteps) * totalLength);
                    points.push({ x: pt.x, y: pt.y });
                }
            }

            document.body.removeChild(svgDoc);

            // Clean collinear and duplicate points
            return this.simplifyPolygon(points, 0.5);
        },

        simplifyPolygon: function (points, tolerance = 0.5) {
            if (points.length <= 3) return points;
            const res = [points[0]];
            for (let i = 1; i < points.length; i++) {
                const prev = res[res.length - 1];
                const curr = points[i];
                const d = Math.hypot(curr.x - prev.x, curr.y - prev.y);
                if (d >= tolerance) {
                    res.push(curr);
                }
            }
            if (res.length > 3) {
                const first = res[0];
                const last = res[res.length - 1];
                if (Math.hypot(last.x - first.x, last.y - first.y) < tolerance) {
                    res.pop();
                }
            }
            return res;
        },

        polygonPerimeter: function (polygon) {
            if (!polygon || polygon.length < 2) return 0;
            let p = 0;
            const n = polygon.length;
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                p += Math.hypot(polygon[j].x - polygon[i].x, polygon[j].y - polygon[i].y);
            }
            if (polygon.holes && polygon.holes.length > 0) {
                polygon.holes.forEach(hole => {
                    const hn = hole.length;
                    for (let hi = 0; hi < hn; hi++) {
                        const hj = (hi + 1) % hn;
                        p += Math.hypot(hole[hj].x - hole[hi].x, hole[hj].y - hole[hi].y);
                    }
                });
            }
            return p;
        },

        // Find collinear overlapping shared edges between two polygons
        findSharedSegments: function (polyA, polyB, tolerance = 2.0) {
            const shared = [];
            const nA = polyA.length;
            const nB = polyB.length;

            for (let i = 0; i < nA; i++) {
                const a1 = polyA[i];
                const a2 = polyA[(i + 1) % nA];
                const lenA = Math.hypot(a2.x - a1.x, a2.y - a1.y);
                if (lenA < 2.0) continue;

                const ux = (a2.x - a1.x) / lenA;
                const uy = (a2.y - a1.y) / lenA;

                for (let j = 0; j < nB; j++) {
                    const b1 = polyB[j];
                    const b2 = polyB[(j + 1) % nB];
                    const lenB = Math.hypot(b2.x - b1.x, b2.y - b1.y);
                    if (lenB < 2.0) continue;

                    const bx = (b2.x - b1.x) / lenB;
                    const by = (b2.y - b1.y) / lenB;

                    // Must be parallel (or anti-parallel)
                    const dot = Math.abs(ux * bx + uy * by);
                    if (dot < 0.98) continue;

                    // Check distance of b1 and b2 from line (a1, a2)
                    const d1 = Math.abs((a2.y - a1.y) * b1.x - (a2.x - a1.x) * b1.y + a2.x * a1.y - a2.y * a1.x) / lenA;
                    const d2 = Math.abs((a2.y - a1.y) * b2.x - (a2.x - a1.x) * b2.y + a2.x * a1.y - a2.y * a1.x) / lenA;
                    if (d1 > tolerance || d2 > tolerance) continue;

                    // Project b1, b2 onto line A parameter t in [0, lenA]
                    const t_b1 = (b1.x - a1.x) * ux + (b1.y - a1.y) * uy;
                    const t_b2 = (b2.x - a1.x) * ux + (b2.y - a1.y) * uy;

                    const minT = Math.max(0, Math.min(t_b1, t_b2));
                    const maxT = Math.min(lenA, Math.max(t_b1, t_b2));

                    if (maxT - minT > 2.0) { // Non-trivial overlap > 2mm
                        shared.push({
                            p1: { x: a1.x + ux * minT, y: a1.y + uy * minT },
                            p2: { x: a1.x + ux * maxT, y: a1.y + uy * maxT },
                            length: maxT - minT
                        });
                    }
                }
            }
            return shared;
        }
    };

    return GeometryUtil;
}));
