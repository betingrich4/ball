export async function GET() {
  const r = await fetch(`${process.env.API_BASE || "http://localhost:8080/api"}/status`, {
    cache: "no-store",
  }).catch(() => null);
  return Response.json(r ? await r.json() : { ok: false });
}
