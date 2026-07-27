"use client";

import { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  type: "error" | "info" | "success";
  message: string;
  duration?: number;
}

let toastListeners: ((msg: ToastMessage) => void)[] = [];

export function showToast(type: ToastMessage["type"], message: string, duration = 5000) {
  const msg: ToastMessage = { id: Date.now().toString(), type, message, duration };
  toastListeners.forEach((fn) => fn(msg));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, msg.duration || 5000);
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handler);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in backdrop-blur-sm ${
            toast.type === "error"
              ? "bg-red-500/90 text-white"
              : toast.type === "success"
              ? "bg-green-500/90 text-white"
              : "bg-gray-800/90 text-gray-200 border border-gray-700"
          }`}
          onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
        >
          <div className="flex items-center gap-2">
            {toast.type === "error" && (
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
