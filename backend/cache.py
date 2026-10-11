import os, json
import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
_client = redis.from_url(REDIS_URL, decode_responses=True)

async def cache_get(key: str):
    try:
        v = await _client.get(key)
        return json.loads(v) if v else None
    except Exception:
        return None

async def cache_set(key: str, value, ttl: int):
    try:
        await _client.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass
