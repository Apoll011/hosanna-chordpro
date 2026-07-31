/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.memo(React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[11px] font-bold text-m3-text/60 uppercase tracking-wider ml-1">
            {label}
          </label>
        )}
        <div className="relative flex items-center group">
          {icon && (
            <div className="absolute left-3.5 pointer-events-none text-m3-secondary group-focus-within:text-m3-primary transition-colors">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl border bg-m3-card text-m3-text text-sm px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-m3-primary/20 ${
              icon ? 'pl-11' : ''
            } ${
              error
                ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-m3-border hover:border-m3-primary/30 focus:border-m3-primary'
            } ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-rose-500 font-medium">{error}</span>}
        {helperText && !error && <span className="text-xs text-slate-500">{helperText}</span>}
      </div>
    );
  }
));

Input.displayName = 'Input';
