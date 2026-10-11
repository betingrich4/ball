"use client";
import { motion } from "framer-motion";

export default function ScoreHeader({ match }: { match: any }) {
  const home = match?.homeTeam || match?.teams?.home || {};
  const away = match?.awayTeam || match?.teams?.away || {};
  const live = match?.status === "live" || match?.status === "inprogress";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-16 z-30 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 backdrop-blur-xl p-6 md:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 justify-end text-right">
          <div className="font-semibold text-lg md:text-xl">{home.name}</div>
          <img src={home.logo} alt="" className="w-12 h-12 object-contain" />
        </div>
        <div className="text-center min-w-[110px]">
          <div className="text-4xl md:text-5xl font-extrabold tabular-nums tracking-tight">
            {home.score ?? 0} <span className="text-slate-600">–</span> {away.score ?? 0}
          </div>
          <div className={`mt-2 text-xs font-bold uppercase tracking-wider ${live ? "text-rose-400" : "text-slate-500"}`}>
            {live && <i className="fa-solid fa-circle text-[6px] mr-1 animate-pulse" />}
            {match?.clock || match?.status || "—"}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-1">
          <img src={away.logo} alt="" className="w-12 h-12 object-contain" />
          <div className="font-semibold text-lg md:text-xl">{away.name}</div>
        </div>
      </div>
    </motion.div>
  );
}
