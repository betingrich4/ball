import { api } from "@/lib/api";
import ScoreHeader from "@/components/ScoreHeader";
import MatchTabs from "@/components/MatchTabs";
import FreshnessBadge from "@/components/FreshnessBadge";

export const revalidate = 20;

export default async function MatchPage({ params }: { params: { league: string; eventId: string } }) {
  const { league, eventId } = params;
  const summary = await api<any>(`/${league}/summary?event=${eventId}`).catch(() => ({}));
  const plays = await api<any>(`/${league}/events/${eventId}/plays?limit=30`).catch(() => ({}));
  const meta = summary?.meta || {};

  return (
    <div className="space-y-6">
      <ScoreHeader match={summary} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-slate-500 uppercase tracking-wider">{league.replace(/-/g, " ")}</h2>
        <FreshnessBadge lastSyncedAt={meta?.lastSyncedAt} />
      </div>
      <MatchTabs summary={summary} plays={plays} />
    </div>
  );
}
