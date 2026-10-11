import Link from "next/link";
import { api, today } from "@/lib/api";
import FreshnessBadge from "@/components/FreshnessBadge";
import LeagueChips from "@/components/LeagueChips";

export const revalidate = 30;

export default async function HomePage() {
  const meta = await api<any>("/meta").catch(() => ({}));
  const leagues = await api<any>("/leagues?available=true").catch(() => ({ leagues: [] }));
  const featured = ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"];
  const scoreboards = await Promise.all(
    featured.map((l) =>
      api<any>(`/${l}/scoreboard?dates=${today()}`)
        .then((r) => ({ league: l, events: r.events || r.data || [] }))
        .catch(() => ({ league: l, events: [] }))
    )
  );
  const allEvents = scoreboards.flatMap((s) => s.events.map((e: any) => ({ ...e, league: s.league })));

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Live Football</h1>
          <p className="text-slate-400 mt-1 text-sm">Scores, standings, and stats across top leagues.</p>
        </div>
        <FreshnessBadge lastSyncedAt={meta?.lastSuccessfulSyncAt} />
      </section>

      <LeagueChips leagues={leagues?.leagues || []} />

      <section>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-bolt text-emerald-400" /> Today
        </h2>
        {allEvents.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-slate-500">
            <i className="fa-regular fa-calendar text-2xl mb-2 block" />
            No matches scheduled today.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allEvents.slice(0, 12).map((m: any) => (
              <Link
                key={`${m.league}-${m.id}`}
                href={`/match/${m.league}/${m.id}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-400/30 p-5 transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">
                  {m.league.replace(/-/g, " ")}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{m.homeTeam?.name}</span>
                  <span className="tabular-nums font-extrabold">{m.homeTeam?.score ?? 0}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold">{m.awayTeam?.name}</span>
                  <span className="tabular-nums font-extrabold">{m.awayTeam?.score ?? 0}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
