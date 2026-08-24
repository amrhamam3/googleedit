import React, { useState, useEffect, useRef } from 'react';
import { NestingPart, NestingConfig, NestingResult, PlacedPart, Language } from '../types/cad';
import { executeNesting, exportNestingToDXF, exportNestingToSVG, getDefaultNestingParts } from '../utils/nestingEngine';
import { translations } from '../utils/translations';
import confetti from 'canvas-confetti';
import {
  Layers,
  Play,
  RotateCw,
  Plus,
  Trash2,
  Download,
  FileCode,
  Gauge,
  Timer,
  Scissors,
  CheckCircle2,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RefreshCcw
} from 'lucide-react';

interface NestingWorkspaceProps {
  language: Language;
}

export const NestingWorkspace: React.FC<NestingWorkspaceProps> = ({ language }) => {
  const t = translations[language];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Nesting parts list state
  const [parts, setParts] = useState<NestingPart[]>(getDefaultNestingParts());

  // Sheet & Optimization configuration
  const [config, setConfig] = useState<NestingConfig>({
    sheetWidth: 1000,
    sheetHeight: 800,
    partSpacing: 5,
    sheetMargin: 10,
    allowRotation: true,
    rotationStep: 90,
    optimizationLevel: 'balanced',
    strategy: 'bottom_left',
  });

  // Selected sheet preset
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');

  // Nesting computation result
  const [nestingResult, setNestingResult] = useState<NestingResult | null>(null);
  const [isNesting, setIsNesting] = useState(false);
  const [progress, setProgress] = useState(0);

  // Canvas View transform (Pan & Zoom)
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Hovered part
  const [hoveredPart, setHoveredPart] = useState<PlacedPart | null>(null);

  // Auto-run nesting on mount
  useEffect(() => {
    runNestingCalculation();
  }, []);

  const runNestingCalculation = () => {
    setIsNesting(true);
    setProgress(10);

    const timer1 = setTimeout(() => setProgress(45), 200);
    const timer2 = setTimeout(() => setProgress(85), 500);

    const timer3 = setTimeout(() => {
      const result = executeNesting(parts, config);
      setNestingResult(result);
      setIsNesting(false);
      setProgress(100);

      // Celebrate high yield
      if (result.efficiency > 70) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#0ea5e9', '#10b981', '#f59e0b'],
        });
      }
    }, 750);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  // Render Nesting Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw Sheet Bed
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, config.sheetWidth, config.sheetHeight);

    // Draw Sheet Grid (100mm lines)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= config.sheetWidth; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, config.sheetHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= config.sheetHeight; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(config.sheetWidth, y);
      ctx.stroke();
    }

    // Draw Sheet Margin boundary
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(
      config.sheetMargin,
      config.sheetMargin,
      config.sheetWidth - config.sheetMargin * 2,
      config.sheetHeight - config.sheetMargin * 2
    );
    ctx.setLineDash([]);

    // Draw Sheet Border Outline
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(0, 0, config.sheetWidth, config.sheetHeight);

    // Draw Sheet Dimensions Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px JetBrains Mono, monospace';
    ctx.fillText(`${config.sheetWidth} mm`, config.sheetWidth / 2 - 40, -12);
    ctx.save();
    ctx.translate(-15, config.sheetHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${config.sheetHeight} mm`, -30, 0);
    ctx.restore();

    // Draw Placed Parts
    if (nestingResult && nestingResult.placedParts) {
      for (const part of nestingResult.placedParts) {
        ctx.save();
        ctx.translate(part.x, part.y);

        // Fill Part Polygon
        ctx.beginPath();
        if (part.polygon && part.polygon.length > 0) {
          ctx.moveTo(part.polygon[0].x, part.polygon[0].y);
          for (let i = 1; i < part.polygon.length; i++) {
            ctx.lineTo(part.polygon[i].x, part.polygon[i].y);
          }
          ctx.closePath();
        }

        const isHovered = hoveredPart?.instanceId === part.instanceId;
        ctx.fillStyle = isHovered ? '#38bdf8' : part.color || 'rgba(14, 165, 233, 0.5)';
        ctx.fill();

        // Laser Cut Path Outline
        ctx.strokeStyle = isHovered ? '#ffffff' : '#0284c7';
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.stroke();

        // Part Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px Cairo, sans-serif';
        ctx.fillText(part.name.substring(0, 14), 6, 18);

        ctx.restore();
      }
    }

    ctx.restore();
  }, [nestingResult, config, zoom, pan, hoveredPart]);

  // Handle Sheet Preset selection
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset === '1000x2000') setConfig(prev => ({ ...prev, sheetWidth: 2000, sheetHeight: 1000 }));
    else if (preset === '1220x2440') setConfig(prev => ({ ...prev, sheetWidth: 2440, sheetHeight: 1220 }));
    else if (preset === '1500x3000') setConfig(prev => ({ ...prev, sheetWidth: 3000, sheetHeight: 1500 }));
    else if (preset === '600x400') setConfig(prev => ({ ...prev, sheetWidth: 600, sheetHeight: 400 }));
  };

  // Modify part quantity
  const updatePartQuantity = (id: string, delta: number) => {
    setParts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty };
        }
        return p;
      })
    );
  };

  // Remove part
  const removePart = (id: string) => {
    setParts(prev => prev.filter(p => p.id !== id));
  };

  // Add a new custom shaped part
  const addNewPart = () => {
    const newId = `custom_part_${Date.now()}`;
    const newPart: NestingPart = {
      id: newId,
      name: `Custom Part #${parts.length + 1}`,
      width: 90,
      height: 60,
      polygon: [
        { x: 0, y: 0 },
        { x: 90, y: 0 },
        { x: 90, y: 35 },
        { x: 45, y: 60 },
        { x: 0, y: 60 },
      ],
      quantity: 4,
      rotationStep: 90,
      allowRotation: true,
      priority: 5,
      color: '#38bdf8',
      area: 90 * 35 + 0.5 * 45 * 25,
    };
    setParts(prev => [...prev, newPart]);
  };

  // Download Export Handlers
  const handleDownloadDXF = () => {
    if (!nestingResult) return;
    const dxfString = exportNestingToDXF(nestingResult, config);
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Amr3D_Nesting_${config.sheetWidth}x${config.sheetHeight}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSVG = () => {
    if (!nestingResult) return;
    const svgString = exportNestingToSVG(nestingResult, config);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Amr3D_Nesting_${config.sheetWidth}x${config.sheetHeight}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 overflow-hidden" id="nesting_workspace">
      {/* Left Control Sidebar */}
      <div className="w-full lg:w-96 bg-slate-900/95 border-b lg:border-b-0 lg:border-e border-slate-800 flex flex-col z-10 shadow-2xl overflow-y-auto">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">{t.nesting_title}</h2>
              <p className="text-[11px] text-slate-400">{t.nesting_desc}</p>
            </div>
          </div>
        </div>

        {/* Sheet Bed Configuration */}
        <div className="p-4 space-y-3 border-b border-slate-800">
          <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
            <span>{t.sheet_size}:</span>
          </label>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: '1000x2000', label: '2000 × 1000 mm' },
              { id: '1220x2440', label: '2440 × 1220 mm (4x8 ft)' },
              { id: '1500x3000', label: '3000 × 1500 mm (Laser Std)' },
              { id: '600x400', label: '600 × 400 mm (Desktop)' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center border transition-all ${
                  selectedPreset === preset.id
                    ? 'bg-sky-600/30 border-sky-500 text-sky-200 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[11px] text-slate-400">{t.sheet_width} (mm):</span>
              <input
                type="number"
                value={config.sheetWidth}
                onChange={e => setConfig(prev => ({ ...prev, sheetWidth: Math.max(100, Number(e.target.value)) }))}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-400">{t.sheet_height} (mm):</span>
              <input
                type="number"
                value={config.sheetHeight}
                onChange={e => setConfig(prev => ({ ...prev, sheetHeight: Math.max(100, Number(e.target.value)) }))}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[11px] text-slate-400">{t.part_spacing} (mm):</span>
              <input
                type="number"
                value={config.partSpacing}
                onChange={e => setConfig(prev => ({ ...prev, partSpacing: Math.max(1, Number(e.target.value)) }))}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-400">{t.sheet_margin} (mm):</span>
              <input
                type="number"
                value={config.sheetMargin}
                onChange={e => setConfig(prev => ({ ...prev, sheetMargin: Math.max(0, Number(e.target.value)) }))}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.allowRotation}
                onChange={e => setConfig(prev => ({ ...prev, allowRotation: e.target.checked }))}
                className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
              />
              <span>{t.allow_rotation}</span>
            </label>

            {config.allowRotation && (
              <select
                value={config.rotationStep}
                onChange={e => setConfig(prev => ({ ...prev, rotationStep: Number(e.target.value) }))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
              >
                <option value="90">90° Step (سريع)</option>
                <option value="45">45° Step (دقيق)</option>
              </select>
            )}
          </div>
        </div>

        {/* Parts List Manager */}
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-sky-400">{t.parts_list} ({parts.length}):</span>
            <button
              onClick={addNewPart}
              className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-lg text-xs flex items-center gap-1 font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.add_part}</span>
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-60 pr-1">
            {parts.map(part => (
              <div
                key={part.id}
                className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: part.color }} />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 truncate">{part.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {part.width} × {part.height} mm
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updatePartQuantity(part.id, -1)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                  >
                    -
                  </button>
                  <span className="text-xs font-mono font-bold text-sky-400 w-5 text-center">{part.quantity}</span>
                  <button
                    onClick={() => updatePartQuantity(part.id, 1)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removePart(part.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-1"
                    title="حذف القطعة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Start Nesting Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={runNestingCalculation}
            disabled={isNesting}
            className="w-full py-3 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-xl shadow-sky-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-98"
          >
            {isNesting ? (
              <>
                <RefreshCcw className="w-4 h-4 animate-spin" />
                <span>{t.nesting_in_progress} ({progress}%)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t.run_nesting}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport & Metrics */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Floating Metrics Bar */}
        {nestingResult && (
          <div className="absolute top-4 left-4 right-4 z-20 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">{t.efficiency}</div>
                <div className="text-lg font-bold font-mono text-emerald-400">{nestingResult.efficiency}%</div>
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">{t.cut_length}</div>
                <div className="text-lg font-bold font-mono text-amber-400">{nestingResult.cutLengthMeters} m</div>
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">{t.parts_placed}</div>
                <div className="text-lg font-bold font-mono text-sky-400">
                  {nestingResult.totalPartsPlaced} قطع
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">{t.est_laser_time}</div>
                <div className="text-lg font-bold font-mono text-indigo-400">
                  {Math.floor(nestingResult.estimatedLaserTimeSeconds / 60)} د {nestingResult.estimatedLaserTimeSeconds % 60} ث
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2D Canvas Stage */}
        <div
          className="flex-1 w-full h-full relative flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-950 cad-grid overflow-hidden"
          onMouseDown={e => {
            isDraggingRef.current = true;
            dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
          }}
          onMouseMove={e => {
            if (isDraggingRef.current) {
              setPan({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y,
              });
            }
          }}
          onMouseUp={() => (isDraggingRef.current = false)}
          onWheel={e => {
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.min(3.0, Math.max(0.2, prev * factor)));
          }}
        >
          <canvas ref={canvasRef} width={1400} height={900} className="w-full h-full object-contain" />
        </div>

        {/* Bottom Floating Export & Zoom Actions */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3 pointer-events-none">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 pointer-events-auto shadow-xl">
            <button
              onClick={() => setZoom(prev => Math.max(0.2, prev - 0.15))}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="تصغير"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(3.0, prev + 0.15))}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="تكبير"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoom(0.85);
                setPan({ x: 40, y: 40 });
              }}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors border-s border-slate-800"
              title="ملاءمة الشاشة"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Export DXF and SVG Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={handleDownloadDXF}
              className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-xl shadow-sky-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <FileCode className="w-4 h-4" />
              <span>{t.export_dxf}</span>
            </button>

            <button
              onClick={handleDownloadSVG}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{t.export_svg}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
