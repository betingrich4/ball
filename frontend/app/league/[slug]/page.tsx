import { api } from "@/lib/api";
import StandingsTable from "@/components/StandingsTable";
import FreshnessBadge from "@/components/FreshnessBadge";

export const revalidate = 60;

export default async function LeaguePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [standings, fixtures, meta] = await Promise.all([
    api<any>(`/${slug}/standings`).catch(() => ({})),
    api<any>(`/${slug}/fixtures?status=all&limit=20`).catch(() => ({})),
    api<any>("/meta").catch(() => ({})),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold capitalize">{slug.replace(/-/g, " ")}</h1>
        <FreshnessBadge lastSyncedAt={meta?.lastSuccessfulSyncAt} />
      </div>

      <section>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-ranking-star text-emerald-400" /> Standings
        </h2>
        <StandingsTable rows={standings?.standings || standings?.table || []} />
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-calendar-days text-emerald-400" /> Fixtures
        </h2>
        <div className="rounded-2xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {(fixtures?.fixtures || fixtures?.events || []).slice(0, 20).map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/[0.03] text-sm">
              <span className="text-slate-500 w-24 text-xs tabular-nums">{f.date?.slice(0, 10)}</span>
              <span className="flex-1 font-medium">{f.homeTeam?.name}</span>
              <span className="tabular-nums text-slate-400">
                {f.homeTeam?.score ?? "–"} : {f.awayTeam?.score ?? "–"}
              </span>
              <span className="flex-1 text-right font-medium">{f.awayTeam?.name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
