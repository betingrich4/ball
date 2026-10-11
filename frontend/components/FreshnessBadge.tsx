"use client";
import { useEffect, useState } from "react";

export default function FreshnessBadge({ lastSyncedAt }: { lastSyncedAt?: string }) {
  const [rel, setRel] = useState("");
  useEffect(() => {
    if (!lastSyncedAt) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000);
      if (diff < 60) setRel(`${diff}s ago`);
      else if (diff < 3600) setRel(`${Math.floor(diff / 60)}m ago`);
      else setRel(`${Math.floor(diff / 3600)}h ago`);
    };
    tick();
    const i = setInterval(tick, 15000);
    return () => clearInterval(i);
  }, [lastSyncedAt]);

  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1">
      <i className="fa-solid fa-circle text-emerald-400 text-[6px] animate-pulse" />
      Updated {rel || "—"}
    </span>
  );
}
