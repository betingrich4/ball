"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { id: "summary", label: "Summary", icon: "fa-list-check" },
  { id: "timeline", label: "Timeline", icon: "fa-timeline" },
  { id: "lineups", label: "Lineups", icon: "fa-users" },
  { id: "stats", label: "Stats", icon: "fa-chart-simple" },
];

export default function MatchTabs({ summary, plays }: any) {
  const [tab, setTab] = useState("summary");

  return (
    <div>
      <div className="flex gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 transition relative ${
              tab === t.id ? "text-emerald-400" : "text-slate-400 hover:text-white"
            }`}
          >
            <i className={`fa-solid ${t.icon}`} />
            {t.label}
            {tab === t.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-400"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="pt-6"
        >
          {tab === "summary" && <SummaryTab summary={summary} />}
          {tab === "timeline" && <TimelineTab plays={plays} />}
          {tab === "lineups" && <LineupsTab summary={summary} />}
          {tab === "stats" && <StatsTab summary={summary} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SummaryTab({ summary }: any) {
  const events = summary?.keyEvents || summary?.events || [];
  if (!events.length) return <Empty label="No key events yet." />;
  return (
    <ul className="space-y-2">
      {events.map((e: any, i: number) => (
        <li key={i} className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/5 p-4">
          <span className="text-slate-500 tabular-nums w-12">{e.minute}'</span>
          <i className={`fa-solid ${iconFor(e.type)} text-emerald-400 w-5 text-center`} />
          <span className="font-medium">{e.player || e.text}</span>
          <span className="text-slate-500 ml-auto text-sm">{e.team}</span>
        </li>
      ))}
    </ul>
  );
}

function TimelineTab({ plays }: any) {
  const list = plays?.plays || plays?.events || [];
  if (!list.length) return <Empty label="No commentary available." />;
  return (
    <ul className="space-y-2">
      {list.map((p: any, i: number) => (
        <li key={i} className="flex gap-4 text-sm rounded-xl bg-white/[0.02] border border-white/5 p-3">
          <span className="text-slate-500 tabular-nums w-12">{p.minute}'</span>
          <span>{p.text}</span>
        </li>
      ))}
    </ul>
  );
}

function LineupsTab({ summary }: any) {
  const home = summary?.lineups?.home || summary?.homeTeam?.roster || [];
  const away = summary?.lineups?.away || summary?.awayTeam?.roster || [];
  if (!home.length && !away.length) return <Empty label="Lineups not available." />;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {[{ name: summary?.homeTeam?.name, list: home }, { name: summary?.awayTeam?.name, list: away }].map((s, i) => (
        <div key={i}>
          <h3 className="font-bold mb-3">{s.name}</h3>
          <ul className="space-y-1">
            {s.list.map((p: any, j: number) => (
              <li key={j} className="flex items-center gap-3 py-2 border-b border-white/5 text-sm">
                <span className="text-slate-500 tabular-nums w-6">{p.jersey || p.number || "-"}</span>
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatsTab({ summary }: any) {
  const stats = summary?.boxscore?.teams || summary?.stats || [];
  if (!stats.length) return <Empty label="Stats not available." />;
  return (
    <div className="space-y-4">
      {stats.map((s: any, i: number) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="tabular-nums font-semibold">{s.home}</span>
            <span className="text-slate-400">{s.label || s.name}</span>
            <span className="tabular-nums font-semibold">{s.away}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${pct(s.home, s.away)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-center py-12 text-slate-500 text-sm">
      <i className="fa-regular fa-circle-question text-2xl block mb-2" />
      {label}
    </div>
  );
}

const iconFor = (t: string) =>
  t === "goal" ? "fa-futbol" : t === "yellow" ? "fa-square" : t === "red" ? "fa-square" : "fa-circle-info";

const pct = (a: number, b: number) => {
  const t = (a || 0) + (b || 0);
  return t ? ((a || 0) / t) * 100 : 50;
};
