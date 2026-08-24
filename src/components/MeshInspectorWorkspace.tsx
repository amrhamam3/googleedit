import React, { useState } from 'react';
import { LoadedModel, Language } from '../types/cad';
import { decimateGeometry } from '../utils/meshTools';
import { calculateMeshInfo } from '../utils/parsers';
import { translations } from '../utils/translations';
import {
  ShieldCheck,
  AlertCircle,
  Scissors,
  Layers,
  Box,
  Scale,
  Sparkles,
  CheckCircle2,
  Minimize2,
  RefreshCw
} from 'lucide-react';

interface MeshInspectorWorkspaceProps {
  model: LoadedModel | null;
  onUpdateModelGeometry: (newGeometry: any, newInfo: any) => void;
  language: Language;
}

export const MeshInspectorWorkspace: React.FC<MeshInspectorWorkspaceProps> = ({
  model,
  onUpdateModelGeometry,
  language,
}) => {
  const t = translations[language];
  const [decimationRatio, setDecimationRatio] = useState(0.5); // 50%
  const [isDecimating, setIsDecimating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!model) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold">يرجى اختيار أو رفع مجسم 3D أولاً لفحص جودته.</p>
        </div>
      </div>
    );
  }

  const { meshInfo } = model;

  const handleApplyDecimation = () => {
    setIsDecimating(true);
    setTimeout(() => {
      const newGeom = decimateGeometry(model.geometry, decimationRatio);
      const newInfo = calculateMeshInfo(newGeom);
      onUpdateModelGeometry(newGeom, newInfo);
      setIsDecimating(false);
      setSuccessMsg(`تم تقليل عدد المضلعات بنجاح إلى ${newInfo.triangleCount.toLocaleString()} مثلث!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    }, 400);
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto" id="mesh_inspector_workspace">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{t.inspector_title}</h2>
            <p className="text-xs text-slate-400">فحص سلامة الأسطح الهندسية، التحقق من الإحكام (Watertight)، وتخفيف حجم الملفات</p>
          </div>
        </div>

        {/* Diagnostics Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${meshInfo.isWatertight ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">{t.watertight}</div>
              <div className={`text-sm font-bold ${meshInfo.isWatertight ? 'text-emerald-400' : 'text-rose-400'}`}>
                {meshInfo.isWatertight ? 'مغلق سليم 100%' : 'يحتوي حواف مفتوحة'}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">{t.triangles}</div>
              <div className="text-sm font-bold font-mono text-sky-400">{meshInfo.triangleCount.toLocaleString()}</div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">الوزن التقديري (ألومنيوم)</div>
              <div className="text-sm font-bold font-mono text-amber-400">~{meshInfo.weightGrams} g</div>
            </div>
          </div>
        </div>

        {/* Detailed Geometric Stats Table */}
        <div className="p-5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
            <Box className="w-4 h-4" />
            <span>البيانات الهندسية والأبعاد الدقيقة (CAD Metrics)</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block mb-1">العرض (X-Axis):</span>
              <span className="text-base font-bold text-slate-100">{meshInfo.boundingBox.size.x} mm</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block mb-1">الطول (Y-Axis):</span>
              <span className="text-base font-bold text-slate-100">{meshInfo.boundingBox.size.y} mm</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block mb-1">الارتفاع (Z-Axis):</span>
              <span className="text-base font-bold text-slate-100">{meshInfo.boundingBox.size.z} mm</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block mb-1">مساحة السطح:</span>
              <span className="text-base font-bold text-emerald-400">{meshInfo.surfaceArea.toLocaleString()} mm²</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono pt-2">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex justify-between items-center">
              <span className="text-slate-400">{t.non_manifold}:</span>
              <span className="font-bold text-emerald-400">{meshInfo.openEdges}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex justify-between items-center">
              <span className="text-slate-400">{t.degenerate_faces}:</span>
              <span className="font-bold text-emerald-400">{meshInfo.degenerateFaces}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex justify-between items-center">
              <span className="text-slate-400">الحجم (Volume):</span>
              <span className="font-bold text-sky-400">{meshInfo.volume.toLocaleString()} mm³</span>
            </div>
          </div>
        </div>

        {/* Mesh Decimator (Edge-Collapse Simplifier) */}
        <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-900/90 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-sky-400">
            <Scissors className="w-4 h-4" />
            <span>محرك تخفيف المضلعات (Mesh Decimator &amp; Simplification)</span>
          </div>
          <p className="text-xs text-slate-400">
            يساعد في تسريع العرض على الهواتف وتقليل حجم ملفات STL الكبيرة دون التأثير على جودة وملمس السطح الخارجي.
          </p>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between text-xs font-semibold text-slate-200">
              <span>{t.decimation_ratio}:</span>
              <span className="font-mono text-sky-400">{Math.round(decimationRatio * 100)}% من الحجم الأصلي</span>
            </div>

            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={decimationRatio}
              onChange={e => setDecimationRatio(Number(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>العدد المستهدف التقريبي: <b className="text-amber-400">{Math.round(meshInfo.triangleCount * decimationRatio).toLocaleString()} مثلث</b></span>
              <span>تخفيض بنسبة <b className="text-emerald-400">{Math.round((1 - decimationRatio) * 100)}%</b></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleApplyDecimation}
              disabled={isDecimating}
              className="px-6 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-xl shadow-sky-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isDecimating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{t.apply_decimate}</span>
            </button>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
