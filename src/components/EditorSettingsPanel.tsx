import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { Button } from './common/Button';
import { useEditorSettings, EDITOR_THEMES } from '../hooks/useEditorSettings';

interface EditorSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditorSettingsPanel: React.FC<EditorSettingsPanelProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useEditorSettings();

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-m3-border rounded-2xl shadow-xl p-4 z-50 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-m3-primary">Definições do Editor</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tema</label>
        <select
          value={settings.theme}
          onChange={(e) => updateSetting('theme', e.target.value)}
          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 cursor-pointer"
        >
          {EDITOR_THEMES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Tamanho da Fonte ({settings.fontSize}px)
        </label>
        <input
          type="range"
          min={10}
          max={24}
          step={1}
          value={settings.fontSize}
          onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
          className="w-full accent-m3-primary cursor-pointer"
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3.5 p-3 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.wordWrap}
            onChange={(e) => updateSetting('wordWrap', e.target.checked)}
            className="w-4 h-4 text-m3-primary rounded-md focus:ring-m3-primary cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Quebra de Linha Automática</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Ajusta o texto à largura do editor, sem scroll horizontal.
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3.5 p-3 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.showLineNumbers}
            onChange={(e) => updateSetting('showLineNumbers', e.target.checked)}
            className="w-4 h-4 text-m3-primary rounded-md focus:ring-m3-primary cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Mostrar Números de Linha</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Apresenta a numeração de linhas na margem esquerda do editor.
            </p>
          </div>
        </label>
      </div>

      <div className="flex items-center justify-end pt-1">
        <Button type="button" variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetSettings}>
          Repor Predefinições
        </Button>
      </div>
    </div>
  );
};