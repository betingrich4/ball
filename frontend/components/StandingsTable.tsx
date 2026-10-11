export default function StandingsTable({ rows }: { rows: any[] }) {
  if (!rows?.length)
    return (
      <div className="text-center py-12 text-slate-500 text-sm rounded-2xl border border-white/10 bg-white/[0.02]">
        <i className="fa-solid fa-table-list text-2xl block mb-2" />
        Standings not available.
      </div>
    );

  const zone = (i: number) =>
    i < 4 ? "border-l-emerald-400" : i < 6 ? "border-l-sky-400" : i >= rows.length - 3 ? "border-l-rose-500" : "border-l-transparent";

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-slate-500 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Club</th>
            <th className="text-right px-4 py-3">P</th>
            <th className="text-right px-4 py-3">W</th>
            <th className="text-right px-4 py-3">D</th>
            <th className="text-right px-4 py-3">L</th>
            <th className="text-right px-4 py-3">GD</th>
            <th className="text-right px-4 py-3">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className={`border-l-4 ${zone(i)} border-t border-white/5 hover:bg-white/[0.03]`}>
              <td className="px-4 py-3 text-slate-500 tabular-nums">{i + 1}</td>
              <td className="px-4 py-3 font-medium flex items-center gap-3">
                {r.logo && <img src={r.logo} className="w-5 h-5 object-contain" alt="" />}
                {r.name || r.team}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.played ?? r.p}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.win ?? r.w}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.draw ?? r.d}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.loss ?? r.l}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.goalDiff ?? r.gd}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold">{r.points ?? r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
