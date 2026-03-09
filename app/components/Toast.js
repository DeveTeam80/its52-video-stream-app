"use client";

import { useState, useEffect, useCallback } from "react";

let toastIdCounter = 0;
let addToastGlobal = null;

export function showToast(message, type = "success") {
  if (addToastGlobal) {
    addToastGlobal({ id: ++toastIdCounter, message, type });
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 3500);
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => {
      addToastGlobal = null;
    };
  }, [addToast]);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() =>
            setToasts((prev) => prev.filter((t) => t.id !== toast.id))
          }
        >
          <span className="toast-icon">
            {toast.type === "success" ? "\u2713" : "\u2717"}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
