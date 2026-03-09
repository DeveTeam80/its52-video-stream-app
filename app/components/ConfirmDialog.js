"use client";

import { useState, useEffect, useCallback } from "react";

let showConfirmGlobal = null;

export function confirmAction(message, { title = "Confirm", confirmText = "Yes, proceed", cancelText = "Cancel", danger = false } = {}) {
  return new Promise((resolve) => {
    if (showConfirmGlobal) {
      showConfirmGlobal({ message, title, confirmText, cancelText, danger, resolve });
    } else {
      resolve(false);
    }
  });
}

export default function ConfirmDialogContainer() {
  const [dialog, setDialog] = useState(null);

  const showConfirm = useCallback((config) => {
    setDialog(config);
  }, []);

  useEffect(() => {
    showConfirmGlobal = showConfirm;
    return () => {
      showConfirmGlobal = null;
    };
  }, [showConfirm]);

  function handleConfirm() {
    dialog?.resolve(true);
    setDialog(null);
  }

  function handleCancel() {
    dialog?.resolve(false);
    setDialog(null);
  }

  if (!dialog) return null;

  return (
    <div className="confirm-overlay" onClick={handleCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">{dialog.title}</h3>
        <p className="confirm-message">{dialog.message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn-cancel" onClick={handleCancel}>
            {dialog.cancelText}
          </button>
          <button
            className={`confirm-btn ${dialog.danger ? "confirm-btn-danger" : "confirm-btn-confirm"}`}
            onClick={handleConfirm}
            autoFocus
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
