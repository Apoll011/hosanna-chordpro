/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = React.memo(
  ({ size = "md", label }) => {
    const sizeMap = {
      sm: "w-4 h-4",
      md: "w-8 h-8",
      lg: "w-12 h-12",
    };

    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-slate-500">
        <Loader2 className={`${sizeMap[size]} animate-spin text-[#0284c7]`} />
        {label && (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {label}
          </p>
        )}
      </div>
    );
  },
);
