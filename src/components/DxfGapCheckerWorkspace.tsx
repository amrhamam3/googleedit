import React, { useState, useEffect, useRef } from 'react';
import { LoadedModel, DxfEntity, DxfGap, Language } from '../types/cad';
import { checkDxfGaps, autoWeldDxfGaps } from '../utils/meshTools';
import { translations } from '../utils/translations';
import {
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Search,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  FileCheck2,
  Sparkles
} from 'lucide-react';

interface DxfGapCheckerWorkspaceProps {
  model: LoadedModel | null;
  language: Language;
}

export const DxfGapCheckerWorkspace: React.FC<DxfGapCheckerWorkspaceProps> = ({ model, language }) => {
  const t = translations[language];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Default sample DXF entities with deliberate micro-gap for demonstration
  const [entities, setEntities] = useState<DxfEntity[]>([
    // Outer boundary with a 0.35mm gap
    { type: 'LINE', start: { x: 50, y: 50 }, end: { x: 300, y: 50 } },
    { type: 'LINE', start: { x: 300, y: 50 }, end: { x: 300, y: 220 } },
    { type: 'LINE', start: { x: 300, y: 220 }, end: { x: 50, y: 220 } },
    { type: 'LINE', start: { x: 50, y: 220 }, end: { x: 50, y: 50.35 } }, // 0.35mm open gap!

    // Internal cutout slot with micro gap
    { type: 'LINE', start: { x: 100, y: 100 }, end: { x: 220, y: 100 } },
    { type: 'LINE', start: { x: 220, y: 100 }, end: { x: 220, y: 160 } },
    { type: 'LINE', start: { x: 220, y: 160 }, end: { x: 100, y: 160 } },
    { type: 'LINE', start: { x: 100, y: 160 }, end: { x: 100, y: 100.42 } }, // 0.42mm gap!

    // Circular mounting holes
    { type: 'CIRCLE', center: { x: 75, y: 185 }, radius: 12 },
    { type: 'CIRCLE', center: { x: 275, y: 185 }, radius: 12 },
  ]);

  const [tolerance, setTolerance] = useState(0.8);
  const [gaps, setGaps] = useState<DxfGap[]>([]);
  const [isFixed, setIsFixed] = useState(false);

  // Canvas View transform
  const [zoom, setZoom] = useState(1.4);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Update entities if model has DXF entities
  useEffect(() => {
    if (model && model.dxfEntities && model.dxfEntities.length > 0) {
      setEntities(model.dxfEntities);
    }
  }, [model]);

  // Run Gap Check whenever entities or tolerance changes
  useEffect(() => {
    const res = checkDxfGaps(entities, tolerance);
    setGaps(res.gaps);
  }, [entities, tolerance]);

  // Auto-Weld gaps
  const handleAutoWeld = () => {
    const repaired = autoWeldDxfGaps(entities, tolerance);
    setEntities(repaired);
    setIsFixed(true);
    setTimeout(() => setIsFixed(false), 3000);
  };

  // Render 2D Vector CAD Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw Entities
    ctx.lineWidth = 1.8;
    for (const ent of entities) {
      ctx.beginPath();
      if (ent.type === 'LINE' && ent.start && ent.end) {
        ctx.strokeStyle = '#38bdf8';
        ctx.moveTo(ent.start.x, ent.start.y);
        ctx.lineTo(ent.end.x, ent.end.y);
        ctx.stroke();

        // Draw endpoint dots
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(ent.start.x, ent.start.y, 2, 0, Math.PI * 2);
        ctx.arc(ent.end.x, ent.end.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.type === 'CIRCLE' && ent.center && ent.radius) {
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(ent.center.x, ent.center.y, ent.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ent.type === 'LWPOLYLINE' && ent.vertices && ent.vertices.length > 1) {
        ctx.strokeStyle = '#38bdf8';
        ctx.moveTo(ent.vertices[0].x, ent.vertices[0].y);
        for (let i = 1; i < ent.vertices.length; i++) {
          ctx.lineTo(ent.vertices[i].x, ent.vertices[i].y);
        }
        if (ent.closed) ctx.closePath();
        ctx.stroke();
      }
    }

    // Highlight Gaps with Pulsating Red Rings & Distance Tags
    for (const gap of gaps) {
      const midX = (gap.point1.x + gap.point2.x) / 2;
      const midY = (gap.point1.y + gap.point2.y) / 2;

      // Glow circle
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.beginPath();
      ctx.arc(midX, midY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Red outer ring
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(midX, midY, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Connecting red line
      ctx.beginPath();
      ctx.moveTo(gap.point1.x, gap.point1.y);
      ctx.lineTo(gap.point2.x, gap.point2.y);
      ctx.stroke();

      // Distance callout badge
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(midX + 12, midY - 14, 60, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${gap.distance}mm`, midX + 16, midY - 2);
    }

    ctx.restore();
  }, [entities, gaps, zoom, pan]);

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 overflow-hidden" id="dxf_gap_checker">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-96 bg-slate-900/95 border-b lg:border-b-0 lg:border-e border-slate-800 flex flex-col z-10 shadow-2xl p-5 overflow-y-auto">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">{t.gap_checker_title}</h2>
            <p className="text-[11px] text-slate-400">{t.gap_checker_desc}</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="my-4 p-4 rounded-2xl border transition-all">
          {gaps.length === 0 ? (
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-7 h-7 shrink-0" />
              <div>
                <div className="text-sm font-bold">{t.all_closed}</div>
                <div className="text-xs text-slate-400 mt-0.5">جاهز للتصدير والتصنيع بليزر وCNC بدون أخطاء.</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-7 h-7 shrink-0 animate-bounce" />
              <div>
                <div className="text-sm font-bold">تم اكتشاف {gaps.length} فجوة غير مغلقة!</div>
                <div className="text-xs text-slate-400 mt-0.5">{t.open_warning}</div>
              </div>
            </div>
          )}
        </div>

        {/* Tolerance Slider */}
        <div className="space-y-2 mb-4 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>{t.tolerance}:</span>
            <span className="font-mono text-sky-400">{tolerance} mm</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="3.0"
            step="0.05"
            value={tolerance}
            onChange={e => setTolerance(Number(e.target.value))}
            className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.05 mm (دقيق جداً)</span>
            <span>3.00 mm (تسامح عالي)</span>
          </div>
        </div>

        {/* Auto-Weld Action Button */}
        <button
          onClick={handleAutoWeld}
          disabled={gaps.length === 0}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98"
        >
          <Wrench className="w-4 h-4" />
          <span>{t.auto_bridge}</span>
        </button>

        {isFixed && (
          <div className="mt-3 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>تم لحام وإغلاق جميع الفجوات بنجاح!</span>
          </div>
        )}

        {/* Discovered Gaps List */}
        <div className="mt-4 flex-1">
          <span className="text-xs font-bold text-slate-400 mb-2 block">سجل الفجوات المكتشفة ({gaps.length}):</span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {gaps.map((gap, i) => (
              <div key={gap.id} className="p-2.5 bg-slate-950 rounded-lg border border-rose-900/40 flex justify-between items-center text-xs font-mono text-slate-300">
                <span className="text-rose-400 font-bold">فجوة #{i + 1}</span>
                <span>المسافة: <b className="text-amber-400">{gap.distance} mm</b></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2D Vector CAD Canvas */}
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
          setZoom(prev => Math.min(4.0, Math.max(0.4, prev * factor)));
        }}
      >
        <canvas ref={canvasRef} width={1200} height={800} className="w-full h-full object-contain" />

        {/* Zoom Controls Overlay */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4.0, z + 0.2))} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => { setZoom(1.4); setPan({ x: 80, y: 60 }); }} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 border-s border-slate-800">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
