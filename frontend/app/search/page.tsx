import { api } from "@/lib/api";
import Link from "next/link";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || "";
  if (!q) return <div className="text-slate-500 py-20 text-center">Type to search.</div>;

  const leagues = await api<any>("/leagues?available=true").catch(() => ({ leagues: [] }));
  const matches = leagues?.leagues?.filter((l: any) =>
    l.name?.toLowerCase().includes(q.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Results for "{q}"</h1>
      {matches.length === 0 ? (
        <div className="text-slate-500 py-12 text-center text-sm">
          <i className="fa-solid fa-magnifying-glass text-2xl block mb-2" />
          No matches found.
        </div>
      ) : (
        <ul className="space-y-2">
          {matches.map((l: any) => (
            <li key={l.slug || l.id}>
              <Link
                href={`/league/${l.slug || l.id}`}
                className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition"
              >
                <i className="fa-solid fa-trophy text-emerald-400" />
                <span className="font-medium">{l.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
