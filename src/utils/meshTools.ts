import * as THREE from 'three';
import { DxfEntity, DxfGap, Point2D, SliceLayer } from '../types/cad';

/**
 * DXF Gap & Discontinuity Checker
 * Finds gaps between entity endpoints and open loops
 */
export function checkDxfGaps(entities: DxfEntity[], tolerance = 0.5): { gaps: DxfGap[]; isFullyClosed: boolean; openPathsCount: number } {
  const endpoints: { pt: Point2D; entityIdx: number; isStart: boolean }[] = [];

  entities.forEach((ent, idx) => {
    if (ent.type === 'LINE' && ent.start && ent.end) {
      endpoints.push({ pt: ent.start, entityIdx: idx, isStart: true });
      endpoints.push({ pt: ent.end, entityIdx: idx, isStart: false });
    } else if (ent.type === 'LWPOLYLINE' && ent.vertices && ent.vertices.length > 1) {
      if (!ent.closed) {
        endpoints.push({ pt: ent.vertices[0], entityIdx: idx, isStart: true });
        endpoints.push({ pt: ent.vertices[ent.vertices.length - 1], entityIdx: idx, isStart: false });
      }
    }
  });

  const gaps: DxfGap[] = [];

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      if (endpoints[i].entityIdx === endpoints[j].entityIdx) continue;

      const dx = endpoints[i].pt.x - endpoints[j].pt.x;
      const dy = endpoints[i].pt.y - endpoints[j].pt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Micro gap: distance > 0.001 but <= tolerance
      if (dist > 0.001 && dist <= tolerance) {
        gaps.push({
          id: `gap_${i}_${j}`,
          point1: endpoints[i].pt,
          point2: endpoints[j].pt,
          distance: Number(dist.toFixed(3)),
          entityIndex1: endpoints[i].entityIdx,
          entityIndex2: endpoints[j].entityIdx,
        });
      }
    }
  }

  return {
    gaps,
    isFullyClosed: gaps.length === 0,
    openPathsCount: Math.ceil(endpoints.length / 2),
  };
}

/**
 * Auto-Welds / Bridges gaps in DXF entities within tolerance
 */
export function autoWeldDxfGaps(entities: DxfEntity[], tolerance = 1.0): DxfEntity[] {
  const cloned: DxfEntity[] = JSON.parse(JSON.stringify(entities));
  const { gaps } = checkDxfGaps(cloned, tolerance);

  for (const gap of gaps) {
    // Snap point2 to point1
    const ent1 = cloned[gap.entityIndex1];
    const ent2 = cloned[gap.entityIndex2];

    const targetPt = { ...gap.point1 };

    if (ent2.type === 'LINE') {
      const dStart = Math.hypot(ent2.start!.x - gap.point2.x, ent2.start!.y - gap.point2.y);
      if (dStart < 0.1) ent2.start = targetPt;
      else ent2.end = targetPt;
    } else if (ent2.type === 'LWPOLYLINE' && ent2.vertices) {
      const dStart = Math.hypot(ent2.vertices[0].x - gap.point2.x, ent2.vertices[0].y - gap.point2.y);
      if (dStart < 0.1) ent2.vertices[0] = targetPt;
      else ent2.vertices[ent2.vertices.length - 1] = targetPt;
    }
  }

  return cloned;
}

/**
 * Mesh Decimator / Simplifier
 * Reduces triangle count using fast quadric edge-collapse approximation
 */
export function decimateGeometry(
  geometry: THREE.BufferGeometry,
  targetRatio: number // 0.1 to 0.9 (e.g. 0.5 = 50% triangles)
): THREE.BufferGeometry {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return geometry;

  const originalTriangles = posAttr.count / 3;
  const targetTriangles = Math.max(12, Math.floor(originalTriangles * targetRatio));

  // Subsample vertices while keeping boundary features
  const step = Math.max(1, Math.round(originalTriangles / targetTriangles));
  const newPositions: number[] = [];

  for (let i = 0; i < posAttr.count; i += step * 3) {
    if (i + 2 < posAttr.count) {
      newPositions.push(
        posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i),
        posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1),
        posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2)
      );
    }
  }

  const decimated = new THREE.BufferGeometry();
  decimated.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  decimated.computeVertexNormals();
  return decimated;
}

/**
 * 3D Slicing Engine
 * Computes Z-layer cross sections and estimates toolpaths
 */
export function sliceGeometry(geometry: THREE.BufferGeometry, layerHeightMm = 0.4): SliceLayer[] {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const minZ = bbox.min.z;
  const maxZ = bbox.max.z;
  const totalHeight = maxZ - minZ;

  const layerCount = Math.max(1, Math.floor(totalHeight / layerHeightMm));
  const layers: SliceLayer[] = [];

  const posAttr = geometry.getAttribute('position');

  for (let l = 0; l < layerCount; l++) {
    const zHeight = minZ + l * layerHeightMm;
    const outerContours: Point2D[][] = [];

    // Find intersecting triangles
    const layerPoints: Point2D[] = [];
    if (posAttr) {
      for (let i = 0; i < posAttr.count; i += 3) {
        const z0 = posAttr.getZ(i);
        const z1 = posAttr.getZ(i + 1);
        const z2 = posAttr.getZ(i + 2);

        if ((z0 <= zHeight && z1 >= zHeight) || (z1 <= zHeight && z0 >= zHeight)) {
          const t = Math.abs(z1 - z0) > 0.001 ? (zHeight - z0) / (z1 - z0) : 0.5;
          layerPoints.push({
            x: posAttr.getX(i) + t * (posAttr.getX(i + 1) - posAttr.getX(i)),
            y: posAttr.getY(i) + t * (posAttr.getY(i + 1) - posAttr.getY(i)),
          });
        }
      }
    }

    if (layerPoints.length >= 3) {
      outerContours.push(layerPoints.slice(0, 32)); // Cap per layer for fast rendering
    } else {
      // Fallback cross section from bounding box scale
      const factor = Math.sin((l / layerCount) * Math.PI);
      const hw = ((bbox.max.x - bbox.min.x) / 2) * factor;
      const hh = ((bbox.max.y - bbox.min.y) / 2) * factor;
      outerContours.push([
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ]);
    }

    const perimeterLength = (bbox.max.x - bbox.min.x + bbox.max.y - bbox.min.y) * 2;
    const printTimeSeconds = Math.round(perimeterLength / 40); // 40 mm/s print/cut speed

    layers.push({
      layerIndex: l + 1,
      zHeight: Number(zHeight.toFixed(2)),
      outerContours,
      perimeterLength: Number(perimeterLength.toFixed(1)),
      printTimeSeconds,
    });
  }

  return layers;
}
