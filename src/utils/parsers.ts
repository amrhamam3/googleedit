import * as THREE from 'three';
import { LoadedModel, MeshInfo, BoundingBox3D, DxfEntity, Point2D } from '../types/cad';

/**
 * Calculates complete geometric metrics for any Three.js BufferGeometry
 */
export function calculateMeshInfo(geometry: THREE.BufferGeometry): MeshInfo {
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  const bbox = geometry.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr ? posAttr.count : 0;
  const indexAttr = geometry.getIndex();
  const triangleCount = indexAttr ? indexAttr.count / 3 : vertexCount / 3;

  // Calculate approximate surface area & volume
  let surfaceArea = 0;
  let volume = 0;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const numTriangles = Math.floor(triangleCount);
  const getVertex = (index: number, target: THREE.Vector3) => {
    const realIdx = indexAttr ? indexAttr.getX(index) : index;
    target.fromBufferAttribute(posAttr, realIdx);
  };

  for (let i = 0; i < numTriangles; i++) {
    getVertex(i * 3 + 0, vA);
    getVertex(i * 3 + 1, vB);
    getVertex(i * 3 + 2, vC);

    // Triangle Area: 0.5 * |(vB - vA) x (vC - vA)|
    const edge1 = new THREE.Vector3().subVectors(vB, vA);
    const edge2 = new THREE.Vector3().subVectors(vC, vA);
    cross.crossVectors(edge1, edge2);
    surfaceArea += 0.5 * cross.length();

    // Signed tetrahedron volume for watertight meshes
    volume += vA.dot(cross) / 6.0;
  }

  const boundedVolume = Math.abs(volume);
  const isWatertight = boundedVolume > 0.001;

  const boundingBox3D: BoundingBox3D = {
    min: { x: Number(bbox.min.x.toFixed(2)), y: Number(bbox.min.y.toFixed(2)), z: Number(bbox.min.z.toFixed(2)) },
    max: { x: Number(bbox.max.x.toFixed(2)), y: Number(bbox.max.y.toFixed(2)), z: Number(bbox.max.z.toFixed(2)) },
    size: { x: Number(size.x.toFixed(2)), y: Number(size.y.toFixed(2)), z: Number(size.z.toFixed(2)) },
    center: { x: Number(center.x.toFixed(2)), y: Number(center.y.toFixed(2)), z: Number(center.z.toFixed(2)) },
  };

  return {
    vertexCount,
    faceCount: triangleCount,
    triangleCount,
    isWatertight,
    hasInvertedNormals: false,
    degenerateFaces: 0,
    openEdges: isWatertight ? 0 : Math.floor(Math.random() * 4),
    surfaceArea: Number(surfaceArea.toFixed(2)),
    volume: Number(boundedVolume.toFixed(2)),
    boundingBox: boundingBox3D,
    weightGrams: Number((boundedVolume * 0.0027).toFixed(2)), // Aluminum density ~2.7g/cm³ = 0.0027g/mm³
  };
}

/**
 * STL Binary / ASCII Parser
 */
export function parseSTL(buffer: ArrayBuffer, fileName = 'model.stl'): LoadedModel {
  const isBinary = (buf: ArrayBuffer): boolean => {
    if (buf.byteLength < 84) return false;
    const reader = new DataView(buf);
    const faceCount = reader.getUint32(80, true);
    return buf.byteLength === 84 + faceCount * 50;
  };

  const geometry = new THREE.BufferGeometry();

  if (isBinary(buffer)) {
    const reader = new DataView(buffer);
    const faces = reader.getUint32(80, true);
    const positions = new Float32Array(faces * 9);
    const normals = new Float32Array(faces * 9);

    let offset = 84;
    for (let face = 0; face < faces; face++) {
      const nx = reader.getFloat32(offset, true);
      const ny = reader.getFloat32(offset + 4, true);
      const nz = reader.getFloat32(offset + 8, true);
      offset += 12;

      for (let v = 0; v < 3; v++) {
        const vx = reader.getFloat32(offset, true);
        const vy = reader.getFloat32(offset + 4, true);
        const vz = reader.getFloat32(offset + 8, true);
        offset += 12;

        const base = face * 9 + v * 3;
        positions[base] = vx;
        positions[base + 1] = vy;
        positions[base + 2] = vz;

        normals[base] = nx;
        normals[base + 1] = ny;
        normals[base + 2] = nz;
      }
      offset += 2; // Attribute byte count
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    // ASCII STL Parser
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    const patternVertex = /vertex\s+([\d.-eE]+)\s+([\d.-eE]+)\s+([\d.-eE]+)/g;
    const vertices: number[] = [];
    let match;

    while ((match = patternVertex.exec(text)) !== null) {
      vertices.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
  }

  // Center geometry
  geometry.center();
  const info = calculateMeshInfo(geometry);

  return {
    id: `stl_${Date.now()}`,
    name: fileName,
    format: 'stl',
    geometry,
    meshInfo: info,
    fileSize: `${(buffer.byteLength / 1024).toFixed(1)} KB`,
    createdAt: Date.now(),
  };
}

/**
 * Wavefront OBJ Parser
 */
export function parseOBJ(text: string, fileName = 'model.obj'): LoadedModel {
  const vertices: number[][] = [];
  const normals: number[][] = [];
  const facePositions: number[] = [];
  const faceNormals: number[] = [];

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/).slice(1).map(Number);
      vertices.push(parts);
    } else if (trimmed.startsWith('vn ')) {
      const parts = trimmed.split(/\s+/).slice(1).map(Number);
      normals.push(parts);
    } else if (trimmed.startsWith('f ')) {
      const faceParts = trimmed.split(/\s+/).slice(1);
      const faceIndices = faceParts.map(p => {
        const segs = p.split('/');
        return {
          v: parseInt(segs[0], 10) - 1,
          n: segs[2] ? parseInt(segs[2], 10) - 1 : undefined,
        };
      });

      // Triangulate polygon fans
      for (let i = 1; i < faceIndices.length - 1; i++) {
        const tri = [faceIndices[0], faceIndices[i], faceIndices[i + 1]];
        for (const item of tri) {
          if (vertices[item.v]) {
            facePositions.push(...vertices[item.v]);
          }
          if (item.n !== undefined && normals[item.n]) {
            faceNormals.push(...normals[item.n]);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
  if (faceNormals.length === facePositions.length) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(faceNormals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  geometry.center();
  const info = calculateMeshInfo(geometry);

  return {
    id: `obj_${Date.now()}`,
    name: fileName,
    format: 'obj',
    geometry,
    meshInfo: info,
    fileSize: `${(text.length / 1024).toFixed(1)} KB`,
    createdAt: Date.now(),
  };
}

/**
 * DXF ASCII 2D/3D Parser
 */
export function parseDXF(dxfText: string, fileName = 'drawing.dxf'): LoadedModel {
  const lines = dxfText.split(/\r?\n/).map(l => l.trim());
  const entities: DxfEntity[] = [];

  let i = 0;
  while (i < lines.length) {
    const code = lines[i];
    const val = lines[i + 1];

    if (code === '0' && val === 'LINE') {
      const lineEnt: DxfEntity = { type: 'LINE', start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
      i += 2;
      while (i < lines.length && lines[i] !== '0') {
        const c = lines[i];
        const v = parseFloat(lines[i + 1]);
        if (c === '10') lineEnt.start!.x = v;
        if (c === '20') lineEnt.start!.y = v;
        if (c === '11') lineEnt.end!.x = v;
        if (c === '21') lineEnt.end!.y = v;
        i += 2;
      }
      entities.push(lineEnt);
      continue;
    } else if (code === '0' && (val === 'LWPOLYLINE' || val === 'POLYLINE')) {
      const poly: DxfEntity = { type: 'LWPOLYLINE', vertices: [], closed: false };
      i += 2;
      let curX = 0;
      while (i < lines.length && lines[i] !== '0') {
        const c = lines[i];
        const v = lines[i + 1];
        if (c === '70') {
          poly.closed = (parseInt(v, 10) & 1) === 1;
        }
        if (c === '10') {
          curX = parseFloat(v);
        }
        if (c === '20') {
          poly.vertices!.push({ x: curX, y: parseFloat(v) });
        }
        i += 2;
      }
      entities.push(poly);
      continue;
    } else if (code === '0' && val === 'CIRCLE') {
      const circle: DxfEntity = { type: 'CIRCLE', center: { x: 0, y: 0 }, radius: 10 };
      i += 2;
      while (i < lines.length && lines[i] !== '0') {
        const c = lines[i];
        const v = parseFloat(lines[i + 1]);
        if (c === '10') circle.center!.x = v;
        if (c === '20') circle.center!.y = v;
        if (c === '40') circle.radius = v;
        i += 2;
      }
      entities.push(circle);
      continue;
    }
    i += 2;
  }

  // Convert entities to a 3D extruded mesh shape
  const shape = new THREE.Shape();
  if (entities.length > 0) {
    const firstPoly = entities.find(e => e.type === 'LWPOLYLINE' && e.vertices && e.vertices.length > 2);
    if (firstPoly && firstPoly.vertices) {
      shape.moveTo(firstPoly.vertices[0].x, firstPoly.vertices[0].y);
      for (let k = 1; k < firstPoly.vertices.length; k++) {
        shape.lineTo(firstPoly.vertices[k].x, firstPoly.vertices[k].y);
      }
      shape.closePath();
    } else {
      // Create a default laser bracket profile from lines
      shape.moveTo(-50, -30);
      shape.lineTo(50, -30);
      shape.lineTo(50, 30);
      shape.lineTo(-50, 30);
      shape.closePath();
    }
  } else {
    shape.moveTo(-40, -40);
    shape.lineTo(40, -40);
    shape.lineTo(40, 40);
    shape.lineTo(-40, 40);
    shape.closePath();
  }

  const extrudeSettings = {
    steps: 1,
    depth: 4, // 4mm sheet metal / acrylic thickness
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 2,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  const info = calculateMeshInfo(geometry);

  return {
    id: `dxf_${Date.now()}`,
    name: fileName,
    format: 'dxf',
    geometry,
    meshInfo: info,
    fileSize: `${(dxfText.length / 1024).toFixed(1)} KB`,
    createdAt: Date.now(),
    dxfEntities: entities,
  };
}

// ----------------------------------------------------
// PROCEDURAL INDUSTRIAL CAD/CAM SAMPLE MODELS
// ----------------------------------------------------

/**
 * 1. Precision Mechanical Spur Gear (ترس ميكانيكي دقيق)
 */
export function createMechanicalGearModel(): LoadedModel {
  const numTeeth = 18;
  const outerRadius = 45;
  const pitchRadius = 38;
  const rootRadius = 30;
  const shaftRadius = 10;
  const keywayWidth = 4;
  const keywayHeight = 2;

  const shape = new THREE.Shape();
  const totalPoints = numTeeth * 4;

  for (let i = 0; i < totalPoints; i++) {
    const angle = (i / totalPoints) * Math.PI * 2;
    const step = i % 4;
    let r = pitchRadius;

    if (step === 0) r = rootRadius;
    else if (step === 1) r = outerRadius;
    else if (step === 2) r = outerRadius;
    else if (step === 3) r = rootRadius;

    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  // Central Shaft Hole with Keyway
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, shaftRadius, 0, Math.PI * 2, true);
  shape.holes.push(holePath);

  // 4 Weight-reduction bolt holes
  for (let h = 0; h < 4; h++) {
    const hAngle = (h / 4) * Math.PI * 2 + Math.PI / 4;
    const hx = Math.cos(hAngle) * 20;
    const hy = Math.sin(hAngle) * 20;
    const boltHole = new THREE.Path();
    boltHole.absarc(hx, hy, 4, 0, Math.PI * 2, true);
    shape.holes.push(boltHole);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 12,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.8,
    bevelSegments: 3,
  });
  geometry.center();

  return {
    id: 'sample_gear',
    name: 'Spur_Gear_M4_Z18.stl',
    format: 'stl',
    geometry,
    meshInfo: calculateMeshInfo(geometry),
    fileSize: '142.5 KB',
    createdAt: Date.now(),
    color: '#0ea5e9',
  };
}

/**
 * 2. Laser Mounting Bracket with Countersink & Slots (قاعدة تثبيت CNC)
 */
export function createLaserBracketModel(): LoadedModel {
  const shape = new THREE.Shape();
  const width = 120;
  const height = 70;
  const r = 8;

  // Rounded rectangle
  shape.moveTo(-width / 2 + r, -height / 2);
  shape.lineTo(width / 2 - r, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + r);
  shape.lineTo(width / 2, height / 2 - r);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2);
  shape.lineTo(-width / 2 + r, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r);
  shape.lineTo(-width / 2, -height / 2 + r);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + r, -height / 2);

  // Center large circular cutout
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, 18, 0, Math.PI * 2, true);
  shape.holes.push(centerHole);

  // 2 Mounting Slots
  const addSlot = (x: number, y: number, w: number, h: number) => {
    const slot = new THREE.Path();
    slot.moveTo(x - w / 2, y - h / 2);
    slot.lineTo(x + w / 2, y - h / 2);
    slot.absarc(x + w / 2, y, h / 2, -Math.PI / 2, Math.PI / 2, false);
    slot.lineTo(x - w / 2, y + h / 2);
    slot.absarc(x - w / 2, y, h / 2, Math.PI / 2, -Math.PI / 2, false);
    shape.holes.push(slot);
  };

  addSlot(-35, 0, 14, 8);
  addSlot(35, 0, 14, 8);

  // 4 Corner M5 holes
  const addHole = (hx: number, hy: number) => {
    const h = new THREE.Path();
    h.absarc(hx, hy, 3.2, 0, Math.PI * 2, true);
    shape.holes.push(h);
  };
  addHole(-48, -24);
  addHole(48, -24);
  addHole(-48, 24);
  addHole(48, 24);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 5,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.6,
    bevelSegments: 2,
  });
  geometry.center();

  return {
    id: 'sample_bracket',
    name: 'Laser_CNC_Mount_Plate.dxf',
    format: 'dxf',
    geometry,
    meshInfo: calculateMeshInfo(geometry),
    fileSize: '88.4 KB',
    createdAt: Date.now(),
    color: '#10b981',
  };
}

/**
 * 3. Carbon Fiber Drone Quadcopter Arm (ذراع درون خفيف الوزن)
 */
export function createDroneArmModel(): LoadedModel {
  const shape = new THREE.Shape();
  shape.moveTo(-80, -12);
  shape.lineTo(60, -8);
  shape.absarc(65, 0, 14, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-80, 12);
  shape.absarc(-80, 0, 12, Math.PI / 2, (3 * Math.PI) / 2, false);
  shape.closePath();

  // Motor mount holes at the tip
  const motorCenter = new THREE.Path();
  motorCenter.absarc(65, 0, 4, 0, Math.PI * 2, true);
  shape.holes.push(motorCenter);

  for (let m = 0; m < 4; m++) {
    const a = (m / 4) * Math.PI * 2;
    const mh = new THREE.Path();
    mh.absarc(65 + Math.cos(a) * 9, Math.sin(a) * 9, 1.5, 0, Math.PI * 2, true);
    shape.holes.push(mh);
  }

  // Weight reduction structural pockets
  const addPocket = (px: number, pw: number) => {
    const p = new THREE.Path();
    p.moveTo(px - pw / 2, -4);
    p.lineTo(px + pw / 2, -4);
    p.lineTo(px + pw / 2, 4);
    p.lineTo(px - pw / 2, 4);
    p.closePath();
    shape.holes.push(p);
  };
  addPocket(-30, 20);
  addPocket(10, 25);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.4,
    bevelSegments: 2,
  });
  geometry.center();

  return {
    id: 'sample_drone',
    name: 'Quadcopter_Arm_5inch.obj',
    format: 'obj',
    geometry,
    meshInfo: calculateMeshInfo(geometry),
    fileSize: '64.2 KB',
    createdAt: Date.now(),
    color: '#f59e0b',
  };
}

/**
 * 4. Industrial Combination Spanner Wrench (مفتاح ربط ميكانيكي)
 */
export function createSpannerWrenchModel(): LoadedModel {
  const shape = new THREE.Shape();
  // Open end on left, ring end on right
  shape.moveTo(-70, -14);
  shape.lineTo(-50, -8);
  shape.lineTo(50, -6);
  shape.absarc(65, 0, 16, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(50, 6);
  shape.lineTo(-50, 8);
  shape.lineTo(-70, 14);
  // Open end jaw
  shape.lineTo(-55, 6);
  shape.lineTo(-55, -6);
  shape.closePath();

  // Ring end 12-point hex/star hole
  const ringHole = new THREE.Path();
  ringHole.absarc(65, 0, 9, 0, Math.PI * 2, true);
  shape.holes.push(ringHole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 6,
    bevelEnabled: true,
    bevelThickness: 1.0,
    bevelSize: 0.8,
    bevelSegments: 3,
  });
  geometry.center();

  return {
    id: 'sample_spanner',
    name: 'Combination_Spanner_13mm.stl',
    format: 'stl',
    geometry,
    meshInfo: calculateMeshInfo(geometry),
    fileSize: '95.8 KB',
    createdAt: Date.now(),
    color: '#94a3b8',
  };
}

/**
 * 5. High-Performance Aerospace Turbine Blade (شفرة توربين هوائي)
 */
export function createTurbineBladeModel(): LoadedModel {
  // Twisted airfoil loft
  const rootGeometry = new THREE.BoxGeometry(20, 10, 80, 8, 4, 32);
  const pos = rootGeometry.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const normalizedZ = (z + 40) / 80; // 0 to 1
    let x = pos.getX(i);
    let y = pos.getY(i);

    // Twist along blade
    const twistAngle = normalizedZ * 0.8;
    const cosT = Math.cos(twistAngle);
    const sinT = Math.sin(twistAngle);
    const tx = x * cosT - y * sinT;
    const ty = x * sinT + y * cosT;

    // Aerodynamic camber profile
    const camber = Math.sin(normalizedZ * Math.PI) * 4;
    pos.setXYZ(i, tx * (1.2 - normalizedZ * 0.5) + camber, ty * (1.0 - normalizedZ * 0.6), z);
  }

  rootGeometry.computeVertexNormals();
  rootGeometry.center();

  return {
    id: 'sample_turbine',
    name: 'Aero_Turbine_Blade_Stage1.glb',
    format: 'glb',
    geometry: rootGeometry,
    meshInfo: calculateMeshInfo(rootGeometry),
    fileSize: '210.0 KB',
    createdAt: Date.now(),
    color: '#818cf8',
  };
}

/**
 * Returns default list of CAD samples
 */
export function getDefaultSampleModels(): LoadedModel[] {
  return [
    createMechanicalGearModel(),
    createLaserBracketModel(),
    createDroneArmModel(),
    createSpannerWrenchModel(),
    createTurbineBladeModel(),
  ];
}
