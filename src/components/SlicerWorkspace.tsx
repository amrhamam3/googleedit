import React, { useState, useEffect, useRef } from 'react';
import { LoadedModel, SliceLayer, Language } from '../types/cad';
import { sliceGeometry } from '../utils/meshTools';
import { translations } from '../utils/translations';
import {
  Layers,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Timer,
  Ruler,
  Compass,
  Zap,
  Gauge
} from 'lucide-react';

interface SlicerWorkspaceProps {
  model: LoadedModel | null;
  language: Language;
}

export const SlicerWorkspace: React.FC<SlicerWorkspaceProps> = ({ model, language }) => {
  const t = translations[language];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [layerHeight, setLayerHeight] = useState(0.4);
  const [currentLayerIdx, setCurrentLayerIdx] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [layers, setLayers] = useState<SliceLayer[]>([]);
  const [nozzleDiameter, setNozzleDiameter] = useState(0.4); // mm
  const [cutSpeed, setCutSpeed] = useState(35); // mm/s

  // Compute slices when model or layer height changes
  useEffect(() => {
    if (!model || !model.geometry) return;
    const computed = sliceGeometry(model.geometry, layerHeight);
    setLayers(computed);
    setCurrentLayerIdx(Math.min(currentLayerIdx, computed.length) || 1);
  }, [model, layerHeight]);

  // Toolpath simulation playback animation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentLayerIdx(prev => {
          if (prev >= layers.length) return 1;
          return prev + 1;
        });
      }, 120);
    }
    return () => clearInterval(interval);
  }, [isPlaying, layers.length]);

  // Render 2D Layer Contour Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layers.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layer = layers[currentLayerIdx - 1];
    if (!layer) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 2.4;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, -scale); // Invert Y for Cartesian coordinates

    // Draw Previous Layers Ghosted in Background (3D Depth illusion)
    const prevCount = Math.min(5, currentLayerIdx - 1);
    for (let p = prevCount; p >= 1; p--) {
      const prevLayer = layers[currentLayerIdx - 1 - p];
      if (prevLayer) {
        ctx.strokeStyle = `rgba(14, 165, 233, ${0.12 / p})`;
        ctx.lineWidth = 1.0;
        for (const contour of prevLayer.outerContours) {
          if (contour.length === 0) continue;
          ctx.beginPath();
          ctx.moveTo(contour[0].x, contour[0].y);
          for (let i = 1; i < contour.length; i++) ctx.lineTo(contour[i].x, contour[i].y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // Draw Current Layer Infill Lines (Hatching)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = nozzleDiameter * 1.5;
    for (let x = -80; x <= 80; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, -60);
      ctx.lineTo(x + 30, 60);
      ctx.stroke();
    }

    // Draw Current Layer Perimeter (Outer Walls)
    for (const contour of layer.outerContours) {
      if (contour.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(contour[0].x, contour[0].y);
      for (let i = 1; i < contour.length; i++) {
        ctx.lineTo(contour[i].x, contour[i].y);
      }
      ctx.closePath();

      // Outer Glow
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = nozzleDiameter * 3;
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = nozzleDiameter * 1.5;
      ctx.stroke();
    }

    // Draw Animated Laser Beam Head
    if (layer.outerContours[0] && layer.outerContours[0].length > 0) {
      const headPt = layer.outerContours[0][(Date.now() / 40) % layer.outerContours[0].length | 0] || layer.outerContours[0][0];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(headPt.x, headPt.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Laser dot glow
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.beginPath();
      ctx.arc(headPt.x, headPt.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [layers, currentLayerIdx, nozzleDiameter]);

  const currentLayer = layers[currentLayerIdx - 1];
  const totalEstTimeSec = layers.reduce((acc, l) => acc + l.printTimeSeconds, 0);

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 overflow-hidden" id="slicer_workspace">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-96 bg-slate-900/95 border-b lg:border-b-0 lg:border-e border-slate-800 flex flex-col z-10 shadow-2xl p-5 overflow-y-auto">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">{t.slicer_title}</h2>
            <p className="text-[11px] text-slate-400">معاينة الطبقات ومسارات رأس الليزر والطباعة 3D</p>
          </div>
        </div>

        {/* Slicing Parameters */}
        <div className="space-y-4 my-4">
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{t.layer_height}:</span>
              <span className="font-mono text-sky-400">{layerHeight} mm</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={layerHeight}
              onChange={e => setLayerHeight(Number(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.10 mm (فائق النعومة)</span>
              <span>1.00 mm (سريع)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">{t.nozzle_size}:</span>
              <select
                value={nozzleDiameter}
                onChange={e => setNozzleDiameter(Number(e.target.value))}
                className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-sky-400 font-mono focus:outline-none"
              >
                <option value="0.2">0.2 mm (Laser Micro)</option>
                <option value="0.4">0.4 mm (Standard)</option>
                <option value="0.6">0.6 mm (High Speed)</option>
                <option value="0.8">0.8 mm (Industrial)</option>
              </select>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">سرعة القطع / الحركة:</span>
              <input
                type="number"
                value={cutSpeed}
                onChange={e => setCutSpeed(Math.max(5, Number(e.target.value)))}
                className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-sky-400 font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Playback Simulation Bar */}
        <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200">
              {t.current_layer}: <b className="text-sky-400 font-mono">{currentLayerIdx} / {layers.length}</b>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Z = {currentLayer?.zHeight || 0} mm
            </span>
          </div>

          <input
            type="range"
            min="1"
            max={Math.max(1, layers.length)}
            value={currentLayerIdx}
            onChange={e => setCurrentLayerIdx(Number(e.target.value))}
            className="w-full accent-indigo-400 cursor-pointer h-2.5 bg-slate-800 rounded-lg"
          />

          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={() => setCurrentLayerIdx(1)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="الطبقة الأولى"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'إيقاف مؤقت' : t.simulate_toolpath}</span>
            </button>
          </div>
        </div>

        {/* Slicer Stats */}
        <div className="mt-4 space-y-2">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">إجمالي وقت التشغيل التقديري:</span>
            <span className="font-mono font-bold text-indigo-400">
              {Math.floor(totalEstTimeSec / 60)} د {totalEstTimeSec % 60} ث
            </span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">محيط المسار للطبقة الحالية:</span>
            <span className="font-mono font-bold text-sky-400">{currentLayer?.perimeterLength || 0} mm</span>
          </div>
        </div>
      </div>

      {/* Main 2D Slicer Canvas */}
      <div className="flex-1 w-full h-full relative flex items-center justify-center bg-slate-950 cad-grid overflow-hidden">
        <canvas ref={canvasRef} width={900} height={700} className="w-full h-full object-contain" />

        {/* Floating Layer Indicator Badge */}
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
            <Layers className="w-4 h-4" />
            <span>Layer #{currentLayerIdx}</span>
          </div>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">Z-Height: <b className="text-sky-400">{currentLayer?.zHeight || 0}mm</b></span>
        </div>
      </div>
    </div>
  );
};
