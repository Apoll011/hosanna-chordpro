/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useSync } from '../../contexts/SyncContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useSync();

  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-m3-primary shrink-0" />,
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-4 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-4 p-5 bg-m3-card/80 backdrop-blur-xl border border-m3-border/50 rounded-2xl shadow-2xl shadow-black/20 animate-in slide-in-from-right-10 duration-300"
        >
          <div className="flex items-center gap-4">
            {icons[toast.type]}
            <p className="text-[13px] font-bold text-m3-text">{toast.text}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-2 text-m3-secondary hover:text-m3-text hover:bg-m3-hover rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
