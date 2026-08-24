import React, { useRef } from 'react';
import { LoadedModel, Language } from '../types/cad';
import { parseSTL, parseOBJ, parseDXF, getDefaultSampleModels } from '../utils/parsers';
import { translations } from '../utils/translations';
import {
  FolderOpen,
  Upload,
  FileCode,
  Box,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  HardDrive
} from 'lucide-react';

interface FileBrowserProps {
  currentModel: LoadedModel | null;
  onSelectModel: (model: LoadedModel) => void;
  modelsList: LoadedModel[];
  onAddCustomModel: (model: LoadedModel) => void;
  language: Language;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  currentModel,
  onSelectModel,
  modelsList,
  onAddCustomModel,
  language,
}) => {
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    const reader = new FileReader();

    if (ext === 'stl') {
      reader.onload = event => {
        const buffer = event.target?.result as ArrayBuffer;
        if (buffer) {
          const model = parseSTL(buffer, fileName);
          onAddCustomModel(model);
          onSelectModel(model);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'obj') {
      reader.onload = event => {
        const text = event.target?.result as string;
        if (text) {
          const model = parseOBJ(text, fileName);
          onAddCustomModel(model);
          onSelectModel(model);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'dxf') {
      reader.onload = event => {
        const text = event.target?.result as string;
        if (text) {
          const model = parseDXF(text, fileName);
          onAddCustomModel(model);
          onSelectModel(model);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const fileName = file.name;
      const ext = fileName.split('.').pop()?.toLowerCase();
      const reader = new FileReader();

      if (ext === 'stl') {
        reader.onload = ev => {
          const buffer = ev.target?.result as ArrayBuffer;
          if (buffer) {
            const model = parseSTL(buffer, fileName);
            onAddCustomModel(model);
            onSelectModel(model);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === 'obj') {
        reader.onload = ev => {
          const text = ev.target?.result as string;
          if (text) {
            const model = parseOBJ(text, fileName);
            onAddCustomModel(model);
            onSelectModel(model);
          }
        };
        reader.readAsText(file);
      } else if (ext === 'dxf') {
        reader.onload = ev => {
          const text = ev.target?.result as string;
          if (text) {
            const model = parseDXF(text, fileName);
            onAddCustomModel(model);
            onSelectModel(model);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto" id="file_browser_view">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{t.files_title}</h2>
            <p className="text-xs text-slate-400">رفع وإدارة نماذج الـ 3D والرسومات الهندسية DXF / STL / OBJ</p>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="p-8 border-2 border-dashed border-sky-500/40 hover:border-sky-400 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl cursor-pointer text-center transition-all group shadow-xl"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".stl,.obj,.dxf,.glb"
            className="hidden"
          />
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">{t.upload_file}</h3>
          <p className="text-xs text-slate-400 mt-1">{t.drag_drop_hint}</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-mono text-sky-400">
            <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700">.STL (3D Mesh)</span>
            <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700">.DXF (AutoCAD Vector)</span>
            <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700">.OBJ (Wavefront)</span>
            <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700">.GLB (glTF 3D)</span>
          </div>
        </div>

        {/* Available Models Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.sample_models}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {modelsList.map(item => {
              const isSelected = currentModel?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectModel(item)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-950/60 border-sky-500 shadow-lg shadow-sky-500/20'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div
                      className={`p-3 rounded-xl ${
                        isSelected ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Box className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-slate-100 truncate">{item.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span className="uppercase text-sky-400 font-bold">{item.format}</span>
                        <span>•</span>
                        <span>{item.fileSize}</span>
                        <span>•</span>
                        <span>{item.meshInfo.triangleCount.toLocaleString()} مثلث</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
