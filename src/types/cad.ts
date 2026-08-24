export type ModelFormat = 'stl' | 'obj' | 'glb' | 'dxf' | 'svg' | 'ai';
export type MaterialType = 'metal' | 'gold' | 'laser_acrylic' | 'titanium' | 'carbon' | 'wood' | 'matte' | 'normal';
export type ShadingMode = 'solid' | 'wireframe' | 'points' | 'xray' | 'normals' | 'layers';
export type CameraView = 'iso' | 'top' | 'front' | 'right' | 'left' | 'bottom' | 'back';
export type Language = 'ar' | 'en' | 'fr' | 'es';
export type ThemeMode = 'cyber' | 'dark' | 'slate' | 'light';
export type ActiveTab = 'viewer' | 'nesting' | 'slicer' | 'gap_checker' | 'inspector' | 'files' | 'audit_report';

export interface BoundingBox3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
}

export interface MeshInfo {
  vertexCount: number;
  faceCount: number;
  triangleCount: number;
  isWatertight: boolean;
  hasInvertedNormals: boolean;
  degenerateFaces: number;
  openEdges: number;
  surfaceArea: number; // mm²
  volume: number; // mm³
  boundingBox: BoundingBox3D;
  weightGrams?: number;
}

export interface LoadedModel {
  id: string;
  name: string;
  format: ModelFormat;
  geometry: any; // THREE.BufferGeometry
  meshInfo: MeshInfo;
  fileSize: string;
  createdAt: number;
  dxfEntities?: DxfEntity[];
  color?: string;
}

export interface MeasurementPoint {
  x: number;
  y: number;
  z: number;
}

export interface MeasurementItem {
  id: string;
  start: MeasurementPoint;
  end: MeasurementPoint;
  distance: number; // mm
  deltaX: number;
  deltaY: number;
  deltaZ: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface DxfEntity {
  type: 'LINE' | 'LWPOLYLINE' | 'POLYLINE' | 'CIRCLE' | 'ARC' | 'SPLINE';
  layer?: string;
  color?: string;
  vertices?: Point2D[];
  start?: Point2D;
  end?: Point2D;
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  closed?: boolean;
}

export interface DxfGap {
  id: string;
  point1: Point2D;
  point2: Point2D;
  distance: number;
  entityIndex1: number;
  entityIndex2: number;
}

export interface NestingPart {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  polygon: Point2D[];
  quantity: number;
  rotationStep: 0 | 45 | 90 | 180;
  allowRotation: boolean;
  priority: number;
  color: string;
  area: number; // mm²
}

export interface PlacedPart {
  partId: string;
  instanceId: string;
  name: string;
  x: number; // mm
  y: number; // mm
  width: number;
  height: number;
  rotation: number; // degrees
  polygon: Point2D[];
  color: string;
}

export interface SheetPreset {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  thickness: number; // mm
  material: string;
}

export interface NestingConfig {
  sheetWidth: number;
  sheetHeight: number;
  partSpacing: number; // margin between parts
  sheetMargin: number; // margin to sheet edge
  allowRotation: boolean;
  rotationStep: number;
  optimizationLevel: 'fast' | 'balanced' | 'deep';
  strategy: 'bottom_left' | 'genetic' | 'concentric';
}

export interface NestingResult {
  placedParts: PlacedPart[];
  unplacedCount: number;
  sheetsUsed: number;
  totalPartsPlaced: number;
  sheetArea: number; // mm²
  usedArea: number; // mm²
  wasteArea: number; // mm²
  efficiency: number; // %
  cutLengthMeters: number; // meters
  estimatedLaserTimeSeconds: number; // seconds
}

export interface SliceLayer {
  layerIndex: number;
  zHeight: number;
  outerContours: Point2D[][];
  infillPaths?: Point2D[][];
  perimeterLength: number;
  printTimeSeconds: number;
}
