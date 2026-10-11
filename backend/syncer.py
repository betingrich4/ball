import asyncio
from cache import cache_set
from upstream import fetch

UPSTREAM = "https://worldcup26.ir"

async def _loop():
    while True:
        try:
            data = await fetch(f"{UPSTREAM}/get/soccer/meta")
            await cache_set("meta", data, 3600)
        except Exception:
            pass
        await asyncio.sleep(300)

def start_syncer():
    asyncio.create_task(_loop())
