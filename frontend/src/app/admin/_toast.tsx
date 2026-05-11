"use client";

import { useEffect, useState } from "react";

interface Toast { id: string; msg: string; type: "success" | "error" | "warn"; }

let toastQueue: Toast[] = [];
let toastListeners: (() => void)[] = [];

export function notify(msg: string, type: Toast["type"] = "success") {
  const t = { id: Math.random().toString(36).slice(2), msg, type };
  toastQueue.push(t);
  toastListeners.forEach(fn => fn());
  setTimeout(() => {
    toastQueue = toastQueue.filter(x => x.id !== t.id);
    toastListeners.forEach(fn => fn());
  }, 3500);
}

export function ToastHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    toastListeners.push(fn);
    return () => { toastListeners = toastListeners.filter(x => x !== fn); };
  }, []);
  return (
    <div className="toasts">
      {toastQueue.map(t => (
        <div key={t.id} className="toast">
          <span style={{ color: t.type === "error" ? "var(--err)" : t.type === "warn" ? "var(--warn)" : "var(--ok)" }}>
            {t.type === "error" ?
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M10.3 3.4 1.8 17.5a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17v.01"/></svg> :
             t.type === "warn" ?
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx={12} cy={12} r={9}/><path d="M12 8v.01M12 12v4"/></svg> :
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M5 13l4 4 10-10"/></svg>}
          </span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
