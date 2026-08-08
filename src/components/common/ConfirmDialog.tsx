/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertTriangle } from "lucide-react";
import React from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          {variant == "danger" && (
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
          )}

          <p className="text-sm text-m3-text leading-relaxed font-medium">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-m3-border/30">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
