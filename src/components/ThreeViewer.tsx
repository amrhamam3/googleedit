import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { LoadedModel, MaterialType, ShadingMode, CameraView, Language, MeasurementItem } from '../types/cad';
import { translations } from '../utils/translations';
import {
  RotateCcw,
  Eye,
  Camera,
  Layers,
  Ruler,
  Maximize2,
  Minimize2,
  Sun,
  Palette,
  Box,
  Compass,
  CheckCircle2,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface ThreeViewerProps {
  model: LoadedModel | null;
  language: Language;
  onTakeSnapshot?: () => void;
}

// Utility to test if WebGL is supported safely without throwing
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({ model, language }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const bboxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  const t = translations[language];

  // WebGL Availability State
  const [isWebGLEnabled, setIsWebGLEnabled] = useState<boolean>(true);

  // Viewer State
  const [materialType, setMaterialType] = useState<MaterialType>('metal');
  const [shadingMode, setShadingMode] = useState<ShadingMode>('solid');
  const [showBBox, setShowBBox] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [lightIntensity, setLightIntensity] = useState(1.5);
  const [lightAngle, setLightAngle] = useState(45);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementItem[]>([]);
  const [activeMeasureStart, setActiveMeasureStart] = useState<THREE.Vector3 | null>(null);

  // Software 3D Camera / Orbit state for Canvas2D fallback
  const [rotX, setRotX] = useState<number>(0.55); // pitch
  const [rotY, setRotY] = useState<number>(0.65); // yaw
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mouse interaction state for manual orbit & zoom
  const isDraggingRef = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  // Initialize Three.js Scene with safe try-catch
  useEffect(() => {
    if (!containerRef.current) return;

    if (!checkWebGLSupport()) {
      setIsWebGLEnabled(false);
      return;
    }

    try {
      const width = containerRef.current.clientWidth || 800;
      const height = containerRef.current.clientHeight || 600;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#090d16');
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
      camera.position.set(120, 100, 150);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      setIsWebGLEnabled(true);

      // Grid Floor
      const grid = new THREE.GridHelper(240, 24, 0x0ea5e9, 0x1e293b);
      grid.position.y = -0.1;
      scene.add(grid);
      gridHelperRef.current = grid;

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
      dirLight.position.set(80, 120, 90);
      dirLight.castShadow = true;
      scene.add(dirLight);
      dirLightRef.current = dirLight;

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
      fillLight.position.set(-80, -40, -90);
      scene.add(fillLight);

      const rimLight = new THREE.PointLight(0x06b6d4, 1.2, 300);
      rimLight.position.set(0, 80, -100);
      scene.add(rimLight);

      // Mesh Group
      const meshGroup = new THREE.Group();
      scene.add(meshGroup);
      meshGroupRef.current = meshGroup;

      // Resize Observer
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          }
        }
      });
      resizeObserver.observe(containerRef.current);

      // Animation Loop
      let animId: number;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (autoRotate && meshGroupRef.current) {
          meshGroupRef.current.rotation.y += 0.008;
        }
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        try {
          renderer.dispose();
        } catch (e) {
          // ignore cleanup errors
        }
      };
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to Canvas2D 3D Software Engine:', err);
      setIsWebGLEnabled(false);
    }
  }, []);

  // Update Geometry & Model (WebGL Mode)
  useEffect(() => {
    if (!isWebGLEnabled || !sceneRef.current || !meshGroupRef.current) return;

    // Clear previous children
    while (meshGroupRef.current.children.length > 0) {
      const obj = meshGroupRef.current.children[0];
      meshGroupRef.current.remove(obj);
    }
    if (bboxHelperRef.current) {
      sceneRef.current.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (!model || !model.geometry) return;

    try {
      const material = createMaterial(materialType, shadingMode, model.color);
      const mainMesh = new THREE.Mesh(model.geometry, material);
      mainMesh.castShadow = true;
      mainMesh.receiveShadow = true;
      meshGroupRef.current.add(mainMesh);

      // Bounding Box Helper
      if (showBBox) {
        const boxHelper = new THREE.BoxHelper(mainMesh, 0x0ea5e9);
        sceneRef.current.add(boxHelper);
        bboxHelperRef.current = boxHelper;
      }

      // Auto-fit camera to model bounds
      if (cameraRef.current) {
        model.geometry.computeBoundingSphere();
        const radius = model.geometry.boundingSphere?.radius || 50;
        const dist = radius * 2.8;
        cameraRef.current.position.set(dist * 0.8, dist * 0.6, dist);
        cameraRef.current.lookAt(0, 0, 0);
      }
    } catch (e) {
      console.warn('Error updating WebGL mesh:', e);
    }
  }, [model, materialType, shadingMode, showBBox, isWebGLEnabled]);

  // Update Directional Light Intensity and Angle (WebGL Mode)
  useEffect(() => {
    if (!dirLightRef.current) return;
    dirLightRef.current.intensity = lightIntensity;
    const rad = (lightAngle * Math.PI) / 180;
    dirLightRef.current.position.set(Math.cos(rad) * 120, 100, Math.sin(rad) * 120);
  }, [lightIntensity, lightAngle]);

  // Update Grid (WebGL Mode)
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Auto-Rotate for Canvas 2D mode
  useEffect(() => {
    if (isWebGLEnabled || !autoRotate) return;
    const interval = setInterval(() => {
      setRotY(prev => prev + 0.015);
    }, 25);
    return () => clearInterval(interval);
  }, [isWebGLEnabled, autoRotate]);

  // ==========================================
  // CANVAS 2D SOFTWARE 3D PROJECTION RENDERER
  // ==========================================
  useEffect(() => {
    if (isWebGLEnabled) return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Deep Dark Blueprint Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 + pan.x;
    const centerY = height / 2 + pan.y;
    const baseScale = Math.min(width, height) * 0.018 * zoom;

    // Helper: 3D to 2D projection
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    const projectPoint = (x: number, y: number, z: number) => {
      // Rotate around Y axis (Yaw)
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      // Rotate around X axis (Pitch)
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      // Isometric / Slight perspective scale
      const fovScale = baseScale;
      const sx = centerX + x1 * fovScale;
      const sy = centerY - y2 * fovScale;

      return { x: sx, y: sy, depth: z2 };
    };

    // 1. Draw 3D Grid Floor
    if (showGrid) {
      ctx.lineWidth = 1;
      const gridSize = 120;
      const gridStep = 20;

      for (let g = -gridSize; g <= gridSize; g += gridStep) {
        // Grid lines parallel to X
        const p1 = projectPoint(-gridSize, -30, g);
        const p2 = projectPoint(gridSize, -30, g);
        ctx.strokeStyle = g === 0 ? 'rgba(14, 165, 233, 0.5)' : 'rgba(30, 41, 59, 0.6)';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Grid lines parallel to Z
        const q1 = projectPoint(g, -30, -gridSize);
        const q2 = projectPoint(g, -30, gridSize);
        ctx.strokeStyle = g === 0 ? 'rgba(14, 165, 233, 0.5)' : 'rgba(30, 41, 59, 0.6)';
        ctx.beginPath();
        ctx.moveTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y);
        ctx.stroke();
      }
    }

    // 2. Render Model Geometry
    if (model && model.geometry) {
      const posAttr = model.geometry.getAttribute('position');
      const indexAttr = model.geometry.getIndex();

      if (posAttr) {
        const vertexCount = posAttr.count;
        const triCount = indexAttr ? indexAttr.count / 3 : Math.floor(vertexCount / 3);

        // Extract and project triangles
        const triangles: Array<{
          p0: { x: number; y: number; depth: number };
          p1: { x: number; y: number; depth: number };
          p2: { x: number; y: number; depth: number };
          normalZ: number;
          avgDepth: number;
          shade: number;
        }> = [];

        // Light vector from lightAngle
        const rad = (lightAngle * Math.PI) / 180;
        const lightDir = {
          x: Math.cos(rad) * 0.7,
          y: 0.8,
          z: Math.sin(rad) * 0.7,
        };
        const lightLen = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
        const normLight = { x: lightDir.x / lightLen, y: lightDir.y / lightLen, z: lightDir.z / lightLen };

        const step = triCount > 4000 ? Math.ceil(triCount / 3000) : 1; // Adapt level of detail for smooth 60fps

        for (let i = 0; i < triCount; i += step) {
          const idx0 = indexAttr ? indexAttr.getX(i * 3) : i * 3;
          const idx1 = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
          const idx2 = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;

          const v0 = { x: posAttr.getX(idx0), y: posAttr.getY(idx0), z: posAttr.getZ(idx0) };
          const v1 = { x: posAttr.getX(idx1), y: posAttr.getY(idx1), z: posAttr.getZ(idx1) };
          const v2 = { x: posAttr.getX(idx2), y: posAttr.getY(idx2), z: posAttr.getZ(idx2) };

          // Calculate surface normal
          const ax = v1.x - v0.x;
          const ay = v1.y - v0.y;
          const az = v1.z - v0.z;
          const bx = v2.x - v0.x;
          const by = v2.y - v0.y;
          const bz = v2.z - v0.z;

          const nx = ay * bz - az * by;
          const ny = az * bx - ax * bz;
          const nz = ax * by - ay * bx;
          const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          const unx = nx / nLen;
          const uny = ny / nLen;
          const unz = nz / nLen;

          // Dot product with light
          const dot = Math.max(0.1, unx * normLight.x + uny * normLight.y + unz * normLight.z);

          const p0 = projectPoint(v0.x, v0.y, v0.z);
          const p1 = projectPoint(v1.x, v1.y, v1.z);
          const p2 = projectPoint(v2.x, v2.y, v2.z);

          const avgDepth = (p0.depth + p1.depth + p2.depth) / 3;

          triangles.push({
            p0,
            p1,
            p2,
            normalZ: unz,
            avgDepth,
            shade: dot,
          });
        }

        // Painter's algorithm: sort triangles from back to front
        triangles.sort((a, b) => a.avgDepth - b.avgDepth);

        // Base color according to material preset
        let baseColor = { r: 14, g: 165, b: 233 }; // default sky
        if (materialType === 'gold') baseColor = { r: 245, g: 158, b: 11 };
        else if (materialType === 'laser_acrylic') baseColor = { r: 16, g: 185, b: 129 };
        else if (materialType === 'titanium') baseColor = { r: 100, g: 116, b: 139 };
        else if (materialType === 'metal') baseColor = { r: 160, g: 170, b: 178 };
        else if (materialType === 'carbon') baseColor = { r: 50, g: 50, b: 55 };
        else if (materialType === 'wood') baseColor = { r: 217, g: 119, b: 6 };

        // Draw each triangle
        for (const tri of triangles) {
          ctx.beginPath();
          ctx.moveTo(tri.p0.x, tri.p0.y);
          ctx.lineTo(tri.p1.x, tri.p1.y);
          ctx.lineTo(tri.p2.x, tri.p2.y);
          ctx.closePath();

          if (shadingMode === 'wireframe') {
            ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.8)`;
            ctx.lineWidth = 1.0;
            ctx.stroke();
          } else if (shadingMode === 'normals') {
            const nr = Math.floor((tri.normalZ * 0.5 + 0.5) * 255);
            const ng = Math.floor((tri.shade * 0.5 + 0.5) * 255);
            const nb = 180;
            ctx.fillStyle = `rgb(${nr}, ${ng}, ${nb})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          } else if (shadingMode === 'xray') {
            ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.25)`;
            ctx.fill();
            ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          } else {
            // Solid shading with directional diffuse lighting
            const intensity = tri.shade * lightIntensity;
            const r = Math.min(255, Math.floor(baseColor.r * intensity));
            const g = Math.min(255, Math.floor(baseColor.g * intensity));
            const b = Math.min(255, Math.floor(baseColor.b * intensity));

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fill();

            // Subtle edge definition
            ctx.strokeStyle = `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.4)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // 3. Draw 3D Bounding Box Overlay
      if (showBBox && model.meshInfo.boundingBox) {
        const { min, max } = model.meshInfo.boundingBox;
        const corners = [
          { x: min.x, y: min.y, z: min.z },
          { x: max.x, y: min.y, z: min.z },
          { x: max.x, y: max.y, z: min.z },
          { x: min.x, y: max.y, z: min.z },
          { x: min.x, y: min.y, z: max.z },
          { x: max.x, y: min.y, z: max.z },
          { x: max.x, y: max.y, z: max.z },
          { x: min.x, y: max.y, z: max.z },
        ].map(p => projectPoint(p.x, p.y, p.z));

        const edges = [
          [0, 1], [1, 2], [2, 3], [3, 0], // Bottom
          [4, 5], [5, 6], [6, 7], [7, 4], // Top
          [0, 4], [1, 5], [2, 6], [3, 7]  // Vertical
        ];

        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        for (const [s, e] of edges) {
          ctx.beginPath();
          ctx.moveTo(corners[s].x, corners[s].y);
          ctx.lineTo(corners[e].x, corners[e].y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // 4. Draw Active Measurements
      if (measurements.length > 0) {
        for (const m of measurements) {
          const p1 = projectPoint(m.start.x, m.start.y, m.start.z);
          const p2 = projectPoint(m.end.x, m.end.y, m.end.z);

          // Line
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          // Points
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
          ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Label
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2 - 8;
          ctx.fillStyle = '#065f46';
          ctx.fillRect(midX - 25, midY - 12, 50, 18);
          ctx.strokeStyle = '#34d399';
          ctx.strokeRect(midX - 25, midY - 12, 50, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${m.distance}mm`, midX, midY + 1);
        }
      }
    }
  }, [
    isWebGLEnabled,
    model,
    rotX,
    rotY,
    zoom,
    pan,
    shadingMode,
    materialType,
    showGrid,
    showBBox,
    lightAngle,
    lightIntensity,
    measurements,
  ]);

  // Helper: Create Material based on Preset (WebGL)
  function createMaterial(type: MaterialType, shading: ShadingMode, customColor?: string): THREE.Material {
    const isWire = shading === 'wireframe';

    if (shading === 'normals') {
      return new THREE.MeshNormalMaterial({ wireframe: isWire });
    }
    if (shading === 'xray') {
      return new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        transmission: 0.9,
        wireframe: isWire,
      });
    }

    switch (type) {
      case 'metal':
        return new THREE.MeshStandardMaterial({
          color: customColor || 0xa0aab2,
          metalness: 0.9,
          roughness: 0.25,
          wireframe: isWire,
        });
      case 'gold':
        return new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          metalness: 0.95,
          roughness: 0.18,
          wireframe: isWire,
        });
      case 'laser_acrylic':
        return new THREE.MeshPhysicalMaterial({
          color: customColor || 0x10b981,
          transparent: true,
          opacity: 0.85,
          roughness: 0.1,
          transmission: 0.6,
          wireframe: isWire,
        });
      case 'titanium':
        return new THREE.MeshStandardMaterial({
          color: 0x27272a,
          metalness: 0.85,
          roughness: 0.3,
          wireframe: isWire,
        });
      case 'carbon':
        return new THREE.MeshStandardMaterial({
          color: 0x18181b,
          metalness: 0.4,
          roughness: 0.6,
          wireframe: isWire,
        });
      case 'wood':
        return new THREE.MeshStandardMaterial({
          color: 0xd97706,
          metalness: 0.05,
          roughness: 0.8,
          wireframe: isWire,
        });
      default:
        return new THREE.MeshStandardMaterial({
          color: customColor || 0x0ea5e9,
          metalness: 0.5,
          roughness: 0.4,
          wireframe: isWire,
        });
    }
  }

  // Camera Presets (Gizmo Views)
  const setCameraView = (view: CameraView) => {
    if (isWebGLEnabled && cameraRef.current) {
      const cam = cameraRef.current;
      const dist = 160;

      switch (view) {
        case 'top':
          cam.position.set(0, dist, 0);
          break;
        case 'bottom':
          cam.position.set(0, -dist, 0);
          break;
        case 'front':
          cam.position.set(0, 0, dist);
          break;
        case 'back':
          cam.position.set(0, 0, -dist);
          break;
        case 'right':
          cam.position.set(dist, 0, 0);
          break;
        case 'left':
          cam.position.set(-dist, 0, 0);
          break;
        case 'iso':
        default:
          cam.position.set(dist * 0.7, dist * 0.6, dist * 0.7);
          break;
      }
      cam.lookAt(0, 0, 0);
    } else {
      // Canvas2D View Angles
      switch (view) {
        case 'top':
          setRotX(Math.PI / 2);
          setRotY(0);
          break;
        case 'bottom':
          setRotX(-Math.PI / 2);
          setRotY(0);
          break;
        case 'front':
          setRotX(0);
          setRotY(0);
          break;
        case 'back':
          setRotX(0);
          setRotY(Math.PI);
          break;
        case 'right':
          setRotX(0);
          setRotY(-Math.PI / 2);
          break;
        case 'left':
          setRotX(0);
          setRotY(Math.PI / 2);
          break;
        case 'iso':
        default:
          setRotX(0.55);
          setRotY(0.65);
          break;
      }
    }
  };

  // Mouse Orbit, Pan & Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
    } else {
      isDraggingRef.current = true;
    }
    prevMousePos.current = { x: e.clientX, y: e.clientY };

    // Point Measurement Click Handling (WebGL Mode)
    if (isWebGLEnabled && measureMode && cameraRef.current && sceneRef.current && containerRef.current && model) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(meshGroupRef.current ? meshGroupRef.current.children : []);

      if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        if (!activeMeasureStart) {
          setActiveMeasureStart(hitPoint.clone());
        } else {
          const dist = hitPoint.distanceTo(activeMeasureStart);
          const newMeasure: MeasurementItem = {
            id: `m_${Date.now()}`,
            start: { x: Number(activeMeasureStart.x.toFixed(1)), y: Number(activeMeasureStart.y.toFixed(1)), z: Number(activeMeasureStart.z.toFixed(1)) },
            end: { x: Number(hitPoint.x.toFixed(1)), y: Number(hitPoint.y.toFixed(1)), z: Number(hitPoint.z.toFixed(1)) },
            distance: Number(dist.toFixed(2)),
            deltaX: Number(Math.abs(hitPoint.x - activeMeasureStart.x).toFixed(1)),
            deltaY: Number(Math.abs(hitPoint.y - activeMeasureStart.y).toFixed(1)),
            deltaZ: Number(Math.abs(hitPoint.z - activeMeasureStart.z).toFixed(1)),
          };
          setMeasurements(prev => [...prev, newMeasure]);
          setActiveMeasureStart(null);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - prevMousePos.current.x;
    const deltaY = e.clientY - prevMousePos.current.y;
    prevMousePos.current = { x: e.clientX, y: e.clientY };

    if (isWebGLEnabled) {
      if (!cameraRef.current) return;
      const cam = cameraRef.current;

      if (isDraggingRef.current) {
        const radius = cam.position.length();
        let theta = Math.atan2(cam.position.x, cam.position.z);
        let phi = Math.acos(Math.max(-1, Math.min(1, cam.position.y / radius)));

        theta -= deltaX * 0.008;
        phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi - deltaY * 0.008));

        cam.position.x = radius * Math.sin(phi) * Math.sin(theta);
        cam.position.y = radius * Math.cos(phi);
        cam.position.z = radius * Math.sin(phi) * Math.cos(theta);
        cam.lookAt(0, 0, 0);
      } else if (isPanningRef.current) {
        const panSpeed = 0.15;
        cam.translateX(-deltaX * panSpeed);
        cam.translateY(deltaY * panSpeed);
      }
    } else {
      // Canvas2D Mouse Updates
      if (isDraggingRef.current) {
        setRotY(prev => prev + deltaX * 0.01);
        setRotX(prev => Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, prev + deltaY * 0.01)));
      } else if (isPanningRef.current) {
        setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isWebGLEnabled) {
      if (!cameraRef.current) return;
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      cameraRef.current.position.multiplyScalar(zoomFactor);
      cameraRef.current.position.clampLength(10, 1000);
    } else {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.2, Math.min(5.0, prev * delta)));
    }
  };

  // High-Resolution Snapshot Exporter
  const handleTakeSnapshot = () => {
    const link = document.createElement('a');
    link.download = `${model?.name || 'Amr3D_Snapshot'}_${Date.now()}.png`;

    if (isWebGLEnabled && rendererRef.current) {
      link.href = rendererRef.current.domElement.toDataURL('image/png');
    } else if (canvas2dRef.current) {
      link.href = canvas2dRef.current.toDataURL('image/png');
    }
    link.click();
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col select-none overflow-hidden" id="three_viewer_container">
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Shading & Display Mode Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 pointer-events-auto shadow-xl">
          <button
            onClick={() => setShadingMode('solid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              shadingMode === 'solid'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={t.solid}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{t.solid}</span>
          </button>

          <button
            onClick={() => setShadingMode('wireframe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              shadingMode === 'wireframe'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={t.wireframe}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.wireframe}</span>
          </button>

          <button
            onClick={() => setShadingMode('normals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              shadingMode === 'normals'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={t.normals}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{t.normals}</span>
          </button>

          <button
            onClick={() => setShadingMode('xray')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              shadingMode === 'xray'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={t.xray}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t.xray}</span>
          </button>
        </div>

        {/* Action Tools: Measurements, Snapshot, Rotate, Grid */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 pointer-events-auto shadow-xl">
          <button
            onClick={() => setMeasureMode(!measureMode)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              measureMode
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={t.ruler_tool}
          >
            <Ruler className="w-4 h-4" />
            <span>{t.ruler_tool}</span>
          </button>

          <button
            onClick={() => setShowBBox(!showBBox)}
            className={`p-1.5 rounded-lg text-xs transition-all ${
              showBBox ? 'text-sky-400 bg-sky-950/60 border border-sky-800/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={t.bounding_box}
          >
            <Box className="w-4 h-4" />
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg text-xs transition-all ${
              autoRotate ? 'text-sky-400 bg-sky-950/60 border border-sky-800/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={t.auto_rotate}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleTakeSnapshot}
            className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title={t.screenshot}
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCameraView('iso')}
            className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title={t.reset_camera}
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      {isWebGLEnabled ? (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={e => e.preventDefault()}
          onWheel={handleWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
        />
      ) : (
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={e => e.preventDefault()}
          onWheel={handleWheel}
          className="w-full h-full relative flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
        >
          <canvas
            ref={canvas2dRef}
            width={1200}
            height={800}
            className="w-full h-full object-contain"
          />

          {/* Fallback Engine Info Badge */}
          <div className="absolute top-16 left-4 z-10 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-sky-500/30 text-sky-300 text-[11px] font-semibold flex items-center gap-2 shadow-xl">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>محرك العرض التوافقي 3D نشط (Canvas 2D Compatibility Mode)</span>
          </div>
        </div>
      )}

      {/* Floating ViewCube Orientation Gizmo (Top Right) */}
      <div className="absolute top-18 right-4 z-10 flex flex-col items-center gap-1 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="text-[10px] font-tech text-sky-400 tracking-wider font-bold mb-1">VIEW CUBE</div>
        <div className="grid grid-cols-3 gap-1">
          <button onClick={() => setCameraView('top')} className="px-2 py-1 bg-slate-800 hover:bg-sky-600 rounded text-[10px] font-bold text-slate-200 col-span-3 transition-colors">
            TOP (علوي)
          </button>
          <button onClick={() => setCameraView('left')} className="px-2 py-1 bg-slate-800 hover:bg-sky-600 rounded text-[10px] font-bold text-slate-200 transition-colors">
            LFT
          </button>
          <button onClick={() => setCameraView('front')} className="px-2 py-1 bg-sky-500/30 border border-sky-500/50 hover:bg-sky-600 rounded text-[10px] font-bold text-sky-200 transition-colors">
            FRONT
          </button>
          <button onClick={() => setCameraView('right')} className="px-2 py-1 bg-slate-800 hover:bg-sky-600 rounded text-[10px] font-bold text-slate-200 transition-colors">
            RGT
          </button>
          <button onClick={() => setCameraView('bottom')} className="px-2 py-1 bg-slate-800 hover:bg-sky-600 rounded text-[10px] font-bold text-slate-200 col-span-3 transition-colors">
            BTM (سفلي)
          </button>
        </div>
        <button
          onClick={() => setCameraView('iso')}
          className="mt-1 w-full py-1 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white rounded text-[10px] font-bold shadow-md transition-all"
        >
          ISO 3D
        </button>
      </div>

      {/* Floating Bottom Toolbar: Materials & Lighting */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Material Presets Palette */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-800 pointer-events-auto shadow-2xl">
          <Palette className="w-4 h-4 text-sky-400 mr-1" />
          <span className="text-xs font-semibold text-slate-300 mr-2">{t.material_preset}:</span>

          <div className="flex items-center gap-1.5">
            {[
              { id: 'metal', name: t.material_metal, color: '#a0aab2' },
              { id: 'gold', name: t.material_gold, color: '#f59e0b' },
              { id: 'laser_acrylic', name: t.material_acrylic, color: '#10b981' },
              { id: 'titanium', name: t.material_titanium, color: '#27272a' },
              { id: 'carbon', name: t.material_carbon, color: '#3f3f46' },
              { id: 'wood', name: t.material_wood, color: '#d97706' },
            ].map(mat => (
              <button
                key={mat.id}
                onClick={() => setMaterialType(mat.id as MaterialType)}
                className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                  materialType === mat.id ? 'border-sky-400 scale-110 shadow-lg shadow-sky-500/50' : 'border-transparent hover:scale-105 opacity-80'
                }`}
                style={{ backgroundColor: mat.color }}
                title={mat.name}
              >
                {materialType === mat.id && <CheckCircle2 className="w-3.5 h-3.5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>

        {/* Lighting Controller Dial */}
        <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-800 pointer-events-auto shadow-2xl">
          <Sun className="w-4 h-4 text-amber-400" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t.light_dial}:</span>
            <input
              type="range"
              min="0"
              max="360"
              value={lightAngle}
              onChange={e => setLightAngle(Number(e.target.value))}
              className="w-24 accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              title="Light Direction Angle"
            />
            <span className="text-xs font-mono text-sky-400 w-9 text-center">{lightAngle}°</span>
          </div>
        </div>

        {/* Model Dimensions Banner */}
        {model && (
          <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 pointer-events-auto shadow-2xl flex items-center gap-4 text-xs font-mono text-slate-300">
            <div>
              <span className="text-slate-400">X:</span>{' '}
              <span className="text-sky-400 font-bold">{model.meshInfo.boundingBox.size.x}mm</span>
            </div>
            <div>
              <span className="text-slate-400">Y:</span>{' '}
              <span className="text-sky-400 font-bold">{model.meshInfo.boundingBox.size.y}mm</span>
            </div>
            <div>
              <span className="text-slate-400">Z:</span>{' '}
              <span className="text-sky-400 font-bold">{model.meshInfo.boundingBox.size.z}mm</span>
            </div>
            <div className="border-s border-slate-700 ps-3 text-slate-400">
              {model.meshInfo.triangleCount.toLocaleString()} {t.triangles}
            </div>
          </div>
        )}
      </div>

      {/* Measurement Items Floating List */}
      {measurements.length > 0 && (
        <div className="absolute top-18 left-4 z-20 bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-2xl max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5" />
              <span>نتائج القياسات (Measurements)</span>
            </span>
            <button
              onClick={() => setMeasurements([])}
              className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
              title="مسح القياسات"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {measurements.map((m, idx) => (
              <div key={m.id} className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
                <div className="flex justify-between font-bold text-emerald-400">
                  <span>قياس #{idx + 1}:</span>
                  <span>{m.distance} mm</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ΔX: {m.deltaX} | ΔY: {m.deltaY} | ΔZ: {m.deltaZ}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Measurement Mode Helper Notice */}
      {measureMode && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 bg-emerald-500/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg backdrop-blur flex items-center gap-2 animate-bounce">
          <Ruler className="w-4 h-4" />
          <span>
            {activeMeasureStart
              ? 'انقر على النقطة الثانية لإكمال القياس...'
              : 'انقر على أي نقطة فوق المجسم لبدء قياس المسافة'}
          </span>
        </div>
      )}
    </div>
  );
};

