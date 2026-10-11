"use client";
import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0e1a]/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <i className="fa-solid fa-futbol text-emerald-400" />
          <span>Pitch</span>
        </Link>
        <form
          action="/search"
          className="flex-1 max-w-md relative"
        >
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clubs, leagues, matches…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-400/50 focus:bg-white/[0.07] transition"
          />
        </form>
        <nav className="hidden md:flex items-center gap-5 text-sm text-slate-400">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/league/premier-league" className="hover:text-white transition">Leagues</Link>
        </nav>
      </div>
    </header>
  );
}
