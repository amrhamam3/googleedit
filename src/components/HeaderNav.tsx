import React from 'react';
import { ActiveTab, Language, ThemeMode, LoadedModel } from '../types/cad';
import { translations } from '../utils/translations';
import {
  Box,
  Layers,
  Scissors,
  Search,
  ShieldCheck,
  FolderOpen,
  Bug,
  Globe,
  Sparkles,
  Palette
} from 'lucide-react';

interface HeaderNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  theme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  currentModel: LoadedModel | null;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onSelectTab,
  language,
  onSelectLanguage,
  theme,
  onSelectTheme,
  currentModel,
}) => {
  const t = translations[language];

  const navTabs: { id: ActiveTab; label: string; icon: any; badge?: string }[] = [
    { id: 'viewer', label: t.tab_viewer, icon: Box },
    { id: 'nesting', label: t.tab_nesting, icon: Layers, badge: 'CAD/CAM' },
    { id: 'slicer', label: t.tab_slicer, icon: Scissors },
    { id: 'gap_checker', label: t.tab_gap_checker, icon: Search },
    { id: 'inspector', label: t.tab_inspector, icon: ShieldCheck },
    { id: 'files', label: t.tab_files, icon: FolderOpen },
    { id: 'audit_report', label: t.tab_audit, icon: Bug, badge: 'تقرير الأخطاء' },
  ];

  return (
    <header className="h-16 bg-slate-900/95 border-b border-slate-800 px-4 flex items-center justify-between gap-4 z-30 shrink-0 select-none shadow-xl">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-cyan-500 to-indigo-600 p-0.5 shadow-lg shadow-sky-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Box className="w-5 h-5 text-sky-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-slate-100 font-tech">Amr3D Preview Pro</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              NESTING &amp; CAD
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-xs">
            {currentModel ? currentModel.name : t.app_subtitle}
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all relative ${
                isActive
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-sky-800 text-sky-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Language & Theme Switcher */}
      <div className="flex items-center gap-2">
        {/* Language Selector */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-1" />
          {(['ar', 'en', 'fr', 'es'] as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => onSelectLanguage(lang)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                language === lang ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
