import React, { useState, useEffect } from 'react';
import { LoadedModel, ActiveTab, Language, ThemeMode } from './types/cad';
import { getDefaultSampleModels } from './utils/parsers';
import { HeaderNav } from './components/HeaderNav';
import { ThreeViewer } from './components/ThreeViewer';
import { NestingWorkspace } from './components/NestingWorkspace';
import { DxfGapCheckerWorkspace } from './components/DxfGapCheckerWorkspace';
import { SlicerWorkspace } from './components/SlicerWorkspace';
import { MeshInspectorWorkspace } from './components/MeshInspectorWorkspace';
import { CodebaseAuditReport } from './components/CodebaseAuditReport';
import { FileBrowser } from './components/FileBrowser';
import { translations } from './utils/translations';
import {
  Box,
  Layers,
  Scissors,
  Search,
  ShieldCheck,
  FolderOpen,
  Bug
} from 'lucide-react';

export default function App() {
  const [sampleModels] = useState<LoadedModel[]>(getDefaultSampleModels());
  const [modelsList, setModelsList] = useState<LoadedModel[]>(sampleModels);
  const [currentModel, setCurrentModel] = useState<LoadedModel | null>(sampleModels[0] || null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('viewer');
  const [language, setLanguage] = useState<Language>('ar');
  const [theme, setTheme] = useState<ThemeMode>('cyber');

  const t = translations[language];

  // Set document dir for RTL (Arabic) / LTR (English/French/Spanish)
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const handleAddCustomModel = (model: LoadedModel) => {
    setModelsList(prev => [model, ...prev]);
  };

  const handleUpdateModelGeometry = (newGeometry: any, newInfo: any) => {
    if (!currentModel) return;
    const updated: LoadedModel = {
      ...currentModel,
      geometry: newGeometry,
      meshInfo: newInfo,
    };
    setCurrentModel(updated);
    setModelsList(prev => prev.map(m => (m.id === updated.id ? updated : m)));
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Header Navigation */}
      <HeaderNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        language={language}
        onSelectLanguage={setLanguage}
        theme={theme}
        onSelectTheme={setTheme}
        currentModel={currentModel}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        {activeTab === 'viewer' && (
          <ThreeViewer model={currentModel} language={language} />
        )}

        {activeTab === 'nesting' && (
          <NestingWorkspace language={language} />
        )}

        {activeTab === 'gap_checker' && (
          <DxfGapCheckerWorkspace model={currentModel} language={language} />
        )}

        {activeTab === 'slicer' && (
          <SlicerWorkspace model={currentModel} language={language} />
        )}

        {activeTab === 'inspector' && (
          <MeshInspectorWorkspace
            model={currentModel}
            onUpdateModelGeometry={handleUpdateModelGeometry}
            language={language}
          />
        )}

        {activeTab === 'files' && (
          <FileBrowser
            currentModel={currentModel}
            onSelectModel={m => {
              setCurrentModel(m);
              setActiveTab('viewer');
            }}
            modelsList={modelsList}
            onAddCustomModel={handleAddCustomModel}
            language={language}
          />
        )}

        {activeTab === 'audit_report' && (
          <CodebaseAuditReport language={language} />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 shrink-0 z-30">
        {[
          { id: 'viewer', icon: Box, label: '3D' },
          { id: 'nesting', icon: Layers, label: 'تعشيش' },
          { id: 'gap_checker', icon: Search, label: 'DXF' },
          { id: 'slicer', icon: Scissors, label: 'Slicer' },
          { id: 'inspector', icon: ShieldCheck, label: 'فحص' },
          { id: 'files', icon: FolderOpen, label: 'ملفات' },
          { id: 'audit_report', icon: Bug, label: 'الأخطاء' },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors ${
                isActive ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
