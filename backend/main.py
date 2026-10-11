import os, time, json
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from cache import cache_get, cache_set
from upstream import fetch
from syncer import start_syncer

app = FastAPI(title="Football Proxy", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

UPSTREAM = "https://worldcup26.ir"
TTL = {
    "leagues": 3600, "meta": 3600, "standings": 1800,
    "scoreboard": 60, "fixtures": 60,
    "summary_live": 30, "summary_done": 86400,
    "plays_live": 20, "plays_done": 86400,
}

@app.on_event("startup")
async def _start():
    start_syncer()

@app.get("/api/status")
async def status():
    meta = await cache_get("meta") or {}
    return {"lastSyncedAt": meta.get("lastSuccessfulSyncAt"), "ok": True}

@app.get("/api/leagues")
async def leagues(kind: str = "all", available: bool = True):
    key = f"leagues:{kind}:{available}"
    if (v := await cache_get(key)): return v
    data = await fetch(f"{UPSTREAM}/get/soccer/leagues?kind={kind}&available={str(available).lower()}")
    await cache_set(key, data, TTL["leagues"]); return data

@app.get("/api/meta")
async def meta():
    if (v := await cache_get("meta")): return v
    data = await fetch(f"{UPSTREAM}/get/soccer/meta")
    await cache_set("meta", data, TTL["meta"]); return data

@app.get("/api/{league}/scoreboard")
async def scoreboard(league: str, dates: str):
    key = f"sb:{league}:{dates}"
    if (v := await cache_get(key)): return v
    data = await fetch(f"{UPSTREAM}/get/soccer/{league}/scoreboard?dates={dates}")
    await cache_set(key, data, TTL["scoreboard"]); return data

@app.get("/api/{league}/fixtures")
async def fixtures(league: str, from_: str = Query(None, alias="from"), to: str = None,
                   status: str = "all", page: int = 1, limit: int = 50):
    key = f"fx:{league}:{from_}:{to}:{status}:{page}:{limit}"
    if (v := await cache_get(key)): return v
    url = f"{UPSTREAM}/get/soccer/{league}/fixtures?status={status}&page={page}&limit={limit}"
    if from_: url += f"&from={from_}"
    if to: url += f"&to={to}"
    data = await fetch(url)
    await cache_set(key, data, TTL["fixtures"]); return data

@app.get("/api/{league}/summary")
async def summary(league: str, event: str):
    key = f"sm:{league}:{event}"
    if (v := await cache_get(key)): return v
    data = await fetch(f"{UPSTREAM}/get/soccer/{league}/summary?event={event}")
    live = data.get("meta", {}).get("status") in ("live", "inprogress")
    await cache_set(key, data, TTL["summary_live" if live else "summary_done"]); return data

@app.get("/api/{league}/events/{event_id}/plays")
async def plays(league: str, event_id: str, page: int = 1, limit: int = 50, important: bool = False):
    key = f"pl:{league}:{event_id}:{page}:{limit}:{important}"
    if (v := await cache_get(key)): return v
    url = f"{UPSTREAM}/get/soccer/{league}/events/{event_id}/plays?page={page}&limit={limit}"
    if important: url += "&important=true"
    data = await fetch(url)
    await cache_set(key, data, TTL["plays_live"]); return data

@app.get("/api/{league}/clubs")
async def clubs(league: str):
    key = f"cl:{league}"
    if (v := await cache_get(key)): return v
    data = await fetch(f"{UPSTREAM}/get/soccer/{league}/clubs")
    await cache_set(key, data, 3600); return data

@app.get("/api/{league}/clubs/{club_id}")
async def club(league: str, club_id: str):
    key = f"cl:{league}:{club_id}"
    if (v := await cache_get(key)): return v
    data = await fetch(f"{UPSTREAM}/get/soccer/{league}/clubs/{club_id}")
    await cache_set(key, data, 3600); return data

@app.get("/api/{league}/standings")
async def standings(league: str, season: str = None):
    key = f"st:{league}:{season}"
    if (v := await cache_get(key)): return v
    url = f"{UPSTREAM}/get/soccer/{league}/standings"
    if season: url += f"?season={season}"
    data = await fetch(url)
    await cache_set(key, data, TTL["standings"]); return data
