/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  total?: number;
  limit?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  total,
  limit,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs">
      <div className="text-slate-500">
        {total !== undefined && limit !== undefined ? (
          <span>
            A mostrar{" "}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">
              {(page - 1) * limit + 1}
            </strong>{" "}
            a{" "}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">
              {Math.min(page * limit, total)}
            </strong>{" "}
            de{" "}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">
              {total}
            </strong>{" "}
            resultados
          </span>
        ) : (
          <span>
            Página {page} de {totalPages}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Página Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 font-semibold text-slate-700 dark:text-slate-300">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Página Seguinte"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
