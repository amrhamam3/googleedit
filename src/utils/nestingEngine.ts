import { NestingPart, NestingConfig, NestingResult, PlacedPart, Point2D } from '../types/cad';

/**
 * Rotates a 2D polygon around origin by given degrees
 */
export function rotatePolygon(polygon: Point2D[], degrees: number): Point2D[] {
  if (degrees === 0) return polygon.map(p => ({ ...p }));
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return polygon.map(p => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));
}

/**
 * Calculates bounding box of polygon
 */
export function getPolygonBounds(polygon: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Checks if two oriented placed rectangles overlap
 */
function rectsOverlap(
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number },
  spacing: number
): boolean {
  return !(
    r1.x + r1.w + spacing <= r2.x ||
    r2.x + r2.w + spacing <= r1.x ||
    r1.y + r1.h + spacing <= r2.y ||
    r2.y + r2.h + spacing <= r1.y
  );
}

/**
 * Computes polygon perimeter (in mm)
 */
export function calculatePolygonPerimeter(polygon: Point2D[]): number {
  let len = 0;
  for (let i = 0; i < polygon.length; i++) {
    const next = polygon[(i + 1) % polygon.length];
    const dx = next.x - polygon[i].x;
    const dy = next.y - polygon[i].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/**
 * High-Performance 2D Nesting Engine
 * Executes bottom-left shelf / skyline packing with multiple rotation steps
 */
export function executeNesting(
  parts: NestingPart[],
  config: NestingConfig
): NestingResult {
  const { sheetWidth, sheetHeight, partSpacing, sheetMargin, allowRotation, rotationStep } = config;

  // Flatten parts list according to quantity
  const itemsToPlace: { part: NestingPart; instanceId: string }[] = [];
  for (const part of parts) {
    for (let q = 0; q < part.quantity; q++) {
      itemsToPlace.push({
        part,
        instanceId: `${part.id}_${q + 1}`,
      });
    }
  }

  // Sort items by priority desc, then by area desc (largest first)
  itemsToPlace.sort((a, b) => {
    if (b.part.priority !== a.part.priority) return b.part.priority - a.part.priority;
    return b.part.area - a.part.area;
  });

  const placedParts: PlacedPart[] = [];
  const allowedRotations = allowRotation ? (rotationStep === 45 ? [0, 45, 90, 135, 180, 270] : [0, 90, 180, 270]) : [0];

  const usableWidth = sheetWidth - sheetMargin * 2;
  const usableHeight = sheetHeight - sheetMargin * 2;

  // Step resolution for position searching (faster search grid)
  const stepGrid = Math.max(2, Math.min(partSpacing || 2, 5));

  for (const item of itemsToPlace) {
    let bestPlacement: { x: number; y: number; rotation: number; poly: Point2D[]; w: number; h: number } | null = null;
    let lowestY = Infinity;
    let lowestX = Infinity;

    for (const rot of allowedRotations) {
      const rotPoly = rotatePolygon(item.part.polygon, rot);
      const bounds = getPolygonBounds(rotPoly);

      // Normalize polygon to start at 0,0
      const normPoly = rotPoly.map(p => ({ x: p.x - bounds.minX, y: p.y - bounds.minY }));
      const w = bounds.width;
      const h = bounds.height;

      if (w > usableWidth || h > usableHeight) continue;

      // Bottom-Left search
      let placed = false;
      for (let y = sheetMargin; y <= sheetHeight - sheetMargin - h; y += stepGrid) {
        for (let x = sheetMargin; x <= sheetWidth - sheetMargin - w; x += stepGrid) {
          const candidateRect = { x, y, w, h };

          // Check collision with all previously placed parts
          let collision = false;
          for (const prev of placedParts) {
            const prevRect = { x: prev.x, y: prev.y, w: prev.width, h: prev.height };
            if (rectsOverlap(candidateRect, prevRect, partSpacing)) {
              collision = true;
              break;
            }
          }

          if (!collision) {
            if (y < lowestY || (y === lowestY && x < lowestX)) {
              lowestY = y;
              lowestX = x;
              bestPlacement = { x, y, rotation: rot, poly: normPoly, w, h };
              placed = true;
              break;
            }
          }
        }
        if (placed && config.optimizationLevel === 'fast') break;
      }
    }

    if (bestPlacement) {
      placedParts.push({
        partId: item.part.id,
        instanceId: item.instanceId,
        name: item.part.name,
        x: bestPlacement.x,
        y: bestPlacement.y,
        width: bestPlacement.w,
        height: bestPlacement.h,
        rotation: bestPlacement.rotation,
        polygon: bestPlacement.poly,
        color: item.part.color,
      });
    }
  }

  // Calculate nesting metrics
  const sheetArea = sheetWidth * sheetHeight;
  let usedArea = 0;
  let totalPerimeter = 0;

  for (const placed of placedParts) {
    const parentPart = parts.find(p => p.id === placed.partId);
    if (parentPart) {
      usedArea += parentPart.area;
      totalPerimeter += calculatePolygonPerimeter(parentPart.polygon);
    }
  }

  const wasteArea = Math.max(0, sheetArea - usedArea);
  const efficiency = sheetArea > 0 ? Number(((usedArea / sheetArea) * 100).toFixed(1)) : 0;
  const cutLengthMeters = Number((totalPerimeter / 1000).toFixed(2));
  
  // Laser cut estimate: average cutting speed ~ 30 mm/s + 0.8s piercing per part
  const cutSpeedMmPerSec = 35;
  const estimatedLaserTimeSeconds = Math.round((totalPerimeter / cutSpeedMmPerSec) + placedParts.length * 0.8);

  return {
    placedParts,
    unplacedCount: itemsToPlace.length - placedParts.length,
    sheetsUsed: placedParts.length > 0 ? 1 : 0,
    totalPartsPlaced: placedParts.length,
    sheetArea,
    usedArea,
    wasteArea,
    efficiency,
    cutLengthMeters,
    estimatedLaserTimeSeconds,
  };
}

/**
 * Exports nested parts layout into a complete DXF ASCII string
 */
export function exportNestingToDXF(result: NestingResult, config: NestingConfig): string {
  let dxf = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nTABLES\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  // Draw Sheet Border (Layer SHEET_BORDER)
  const sw = config.sheetWidth;
  const sh = config.sheetHeight;
  dxf += `0\nLWPOLYLINE\n8\nSHEET_BORDER\n90\n4\n70\n1\n`;
  dxf += `10\n0.0\n20\n0.0\n10\n${sw}\n20\n0.0\n10\n${sw}\n20\n${sh}\n10\n0.0\n20\n${sh}\n`;

  // Draw Placed Parts (Layer PARTS_CUT)
  for (const part of result.placedParts) {
    if (!part.polygon || part.polygon.length === 0) continue;
    dxf += `0\nLWPOLYLINE\n8\nPARTS_CUT\n90\n${part.polygon.length}\n70\n1\n`;
    for (const pt of part.polygon) {
      const globalX = (part.x + pt.x).toFixed(3);
      const globalY = (part.y + pt.y).toFixed(3);
      dxf += `10\n${globalX}\n20\n${globalY}\n`;
    }
  }

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

/**
 * Exports nested parts layout into a complete SVG vector string
 */
export function exportNestingToSVG(result: NestingResult, config: NestingConfig): string {
  const sw = config.sheetWidth;
  const sh = config.sheetHeight;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sw} ${sh}" width="${sw}mm" height="${sh}mm">\n`;
  svg += `  <style>\n`;
  svg += `    .sheet { fill: #0f172a; stroke: #38bdf8; stroke-width: 1.5; }\n`;
  svg += `    .part { fill: rgba(14, 165, 233, 0.35); stroke: #38bdf8; stroke-width: 1.0; }\n`;
  svg += `    .text { fill: #ffffff; font-family: monospace; font-size: 10px; }\n`;
  svg += `  </style>\n`;

  // Sheet background & frame
  svg += `  <rect class="sheet" x="0" y="0" width="${sw}" height="${sh}" />\n`;

  // Placed parts polygons
  for (const part of result.placedParts) {
    const pointsStr = part.polygon.map(p => `${(part.x + p.x).toFixed(1)},${(sh - (part.y + p.y)).toFixed(1)}`).join(' ');
    svg += `  <polygon class="part" points="${pointsStr}" />\n`;
    svg += `  <text class="text" x="${(part.x + 5).toFixed(1)}" y="${(sh - (part.y + 5)).toFixed(1)}">${part.name}</text>\n`;
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Creates default sample nesting parts for testing and immediate demonstration
 */
export function getDefaultNestingParts(): NestingPart[] {
  return [
    {
      id: 'part_bracket_l',
      name: 'L-Bracket Base 120x80',
      width: 120,
      height: 80,
      polygon: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 35 },
        { x: 40, y: 35 },
        { x: 40, y: 80 },
        { x: 0, y: 80 },
      ],
      quantity: 6,
      rotationStep: 90,
      allowRotation: true,
      priority: 10,
      color: '#0ea5e9',
      area: 120 * 35 + 40 * 45, // 6000 mm²
    },
    {
      id: 'part_tri_gusset',
      name: 'Triangular Gusset 70x70',
      width: 70,
      height: 70,
      polygon: [
        { x: 0, y: 0 },
        { x: 70, y: 0 },
        { x: 70, y: 25 },
        { x: 25, y: 70 },
        { x: 0, y: 70 },
      ],
      quantity: 10,
      rotationStep: 90,
      allowRotation: true,
      priority: 8,
      color: '#10b981',
      area: 3200,
    },
    {
      id: 'part_circular_flange',
      name: 'Motor Flange Disc D90',
      width: 90,
      height: 90,
      polygon: Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return { x: 45 + Math.cos(a) * 45, y: 45 + Math.sin(a) * 45 };
      }),
      quantity: 4,
      rotationStep: 45,
      allowRotation: true,
      priority: 9,
      color: '#f59e0b',
      area: Math.round(Math.PI * 45 * 45),
    },
    {
      id: 'part_t_connector',
      name: 'T-Shape Joint 100x90',
      width: 100,
      height: 90,
      polygon: [
        { x: 30, y: 0 },
        { x: 70, y: 0 },
        { x: 70, y: 55 },
        { x: 100, y: 55 },
        { x: 100, y: 90 },
        { x: 0, y: 90 },
        { x: 0, y: 55 },
        { x: 30, y: 55 },
      ],
      quantity: 5,
      rotationStep: 90,
      allowRotation: true,
      priority: 7,
      color: '#8b5cf6',
      area: 40 * 55 + 100 * 35,
    },
    {
      id: 'part_spacer_strip',
      name: 'Reinforcement Strip 140x25',
      width: 140,
      height: 25,
      polygon: [
        { x: 0, y: 0 },
        { x: 140, y: 0 },
        { x: 140, y: 25 },
        { x: 0, y: 25 },
      ],
      quantity: 8,
      rotationStep: 90,
      allowRotation: true,
      priority: 5,
      color: '#ec4899',
      area: 140 * 25,
    },
  ];
}
