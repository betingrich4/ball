const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api";

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { ...init, next: { revalidate: 30 } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};
