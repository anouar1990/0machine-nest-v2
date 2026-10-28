/**
 * 0machine Cost & Material Devis Engine
 * Real-time calculation of Sheet Weight, Material Cost, Laser Cutting Time,
 * Scrap Value, and Common-Line Savings (in Moroccan Dirhams MAD / DH).
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CostCalculator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MATERIALS = {
        'steel': {
            id: 'steel',
            name: 'Mild Steel (Acier doux S235)',
            density: 7.85, // g/cm3
            pricePerKg: 18.0, // MAD per kg
            cuttingSpeedBase: 2.8, // m/min for 2mm laser
            pierceTime: 0.8 // sec per pierce
        },
        'inox': {
            id: 'inox',
            name: 'Stainless Steel (Inox 304)',
            density: 7.93,
            pricePerKg: 52.0,
            cuttingSpeedBase: 2.2,
            pierceTime: 1.2
        },
        'aluminum': {
            id: 'aluminum',
            name: 'Aluminum (Alu 5083)',
            density: 2.70,
            pricePerKg: 62.0,
            cuttingSpeedBase: 3.2,
            pierceTime: 0.6
        },
        'brass': {
            id: 'brass',
            name: 'Brass (Laiton CuZn37)',
            density: 8.50,
            pricePerKg: 88.0,
            cuttingSpeedBase: 2.0,
            pierceTime: 1.0
        },
        'mdf': {
            id: 'mdf',
            name: 'Wood / MDF',
            density: 0.78,
            pricePerKg: 9.5,
            cuttingSpeedBase: 4.5,
            pierceTime: 0.3
        }
    };

    class CostCalculator {
        constructor() {
            this.machineHourlyRate = 350; // MAD / hour (standard fiber laser CNC rate)
        }

        getMaterials() {
            return MATERIALS;
        }

        /**
         * Calculate detailed quotation for a nested job
         */
        calculate(params) {
            const {
                materialId = 'steel',
                thickness = 2.0, // mm
                sheetWidth = 1000, // mm
                sheetHeight = 600, // mm
                sheetCount = 1,
                totalPlacedArea = 0, // mm2
                totalPartsCount = 0,
                totalPerimeterMm = 0, // mm of cutting line
                sharedCutMm = 0 // mm of common cut lines
            } = params;

            const mat = MATERIALS[materialId] || MATERIALS.steel;

            // Sheet Dimensions in meters
            const sheetAreaM2 = (sheetWidth * sheetHeight) / 1e6;
            const totalSheetAreaM2 = sheetAreaM2 * sheetCount;
            const usedAreaM2 = totalPlacedArea / 1e6;
            const wasteAreaM2 = Math.max(0, totalSheetAreaM2 - usedAreaM2);
            const utilizationPercent = totalSheetAreaM2 > 0 ? (usedAreaM2 / totalSheetAreaM2) * 100 : 0;

            // Weight calculation: Area (m2) * Thickness (mm) * Density (g/cm3) = kg
            const weightPerSheetKg = sheetAreaM2 * thickness * mat.density;
            const totalWeightKg = weightPerSheetKg * sheetCount;
            const usedWeightKg = usedAreaM2 * thickness * mat.density;
            const wasteWeightKg = Math.max(0, totalWeightKg - usedWeightKg);

            // Material Cost
            const sheetCostMAD = weightPerSheetKg * mat.pricePerKg;
            const totalMaterialCostMAD = totalWeightKg * mat.pricePerKg;
            const usedMaterialCostMAD = usedWeightKg * mat.pricePerKg;
            const wasteMaterialCostMAD = wasteWeightKg * mat.pricePerKg;

            // Cutting Speed adjusted by thickness
            const speedFactor = Math.max(0.3, Math.min(2.0, 2.0 / thickness));
            const actualCutSpeedMMin = mat.cuttingSpeedBase * speedFactor;

            // Net cutting distance (total perimeter minus shared common line)
            const netCuttingDistanceM = Math.max(0, (totalPerimeterMm - sharedCutMm) / 1000);
            const savedCuttingDistanceM = sharedCutMm / 1000;

            // Laser Cutting Time (Minutes)
            const cuttingMinutes = actualCutSpeedMMin > 0 ? (netCuttingDistanceM / actualCutSpeedMMin) : 0;
            const pierceSeconds = totalPartsCount * mat.pierceTime;
            const totalTimeMinutes = cuttingMinutes + (pierceSeconds / 60);

            // Savings from Common-Line Cutting
            const savedTimeMinutes = actualCutSpeedMMin > 0 ? (savedCuttingDistanceM / actualCutSpeedMMin) : 0;
            const savedMoneyMAD = (savedTimeMinutes / 60) * this.machineHourlyRate;

            // Machining Cost
            const machiningCostMAD = (totalTimeMinutes / 60) * this.machineHourlyRate;

            // Total Job Estimate (Devis)
            const totalCostMAD = totalMaterialCostMAD + machiningCostMAD;
            const unitPricePerPart = totalPartsCount > 0 ? (totalCostMAD / totalPartsCount) : 0;

            return {
                material: mat,
                thickness: thickness,
                sheetCount: sheetCount,
                weightKg: Number(totalWeightKg.toFixed(2)),
                utilizationPercent: Number(utilizationPercent.toFixed(1)),
                totalMaterialCostMAD: Math.round(totalMaterialCostMAD),
                usedMaterialCostMAD: Math.round(usedMaterialCostMAD),
                wasteMaterialCostMAD: Math.round(wasteMaterialCostMAD),
                cuttingTimeMinutes: Number(totalTimeMinutes.toFixed(1)),
                machiningCostMAD: Math.round(machiningCostMAD),
                totalCostMAD: Math.round(totalCostMAD),
                unitPricePerPart: Number(unitPricePerPart.toFixed(1)),
                sharedCutMm: Math.round(sharedCutMm),
                savedTimeMinutes: Number(savedTimeMinutes.toFixed(1)),
                savedMoneyMAD: Math.round(savedMoneyMAD)
            };
        }
    }

    return CostCalculator;
}));
