import Link from "next/link";

export default function LeagueChips({ leagues }: { leagues: any[] }) {
  if (!leagues?.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {leagues.slice(0, 20).map((l: any) => (
        <Link
          key={l.slug || l.id}
          href={`/league/${l.slug || l.id}`}
          className="whitespace-nowrap text-sm px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-emerald-400/40 hover:bg-white/[0.08] transition text-slate-300"
        >
          {l.name}
        </Link>
      ))}
    </div>
  );
}
