import os, httpx, asyncio
from fastapi import HTTPException

API_KEY = os.getenv("FOOTBALL_API_KEY")
HEADERS = {"Accept": "application/json"}
if API_KEY: HEADERS["Authorization"] = f"Bearer {API_KEY}"

async def fetch(url: str, tries: int = 3):
    for i in range(tries):
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.get(url, headers=HEADERS)
            if r.status_code == 200: return r.json()
            if r.status_code in (500, 502, 503, 504):
                await asyncio.sleep(2 ** i); continue
            raise HTTPException(status_code=r.status_code, detail="Upstream error")
        except httpx.RequestError:
            if i == tries - 1: raise HTTPException(503, "Upstream unavailable")
            await asyncio.sleep(2 ** i)
    raise HTTPException(503, "Upstream unavailable")
