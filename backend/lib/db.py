"""Shared Mongo handle."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [
        IndexModel([("timestamp", DESCENDING)]),
    ],
    "users": [
        IndexModel([("id", ASCENDING)], unique=True),
        IndexModel([("email", ASCENDING)], unique=True),
    ],
    "profiles": [
        IndexModel([("user_id", ASCENDING)], unique=True, sparse=True),
    ],
    "exercises": [
        IndexModel([("id", ASCENDING)], unique=True),
        IndexModel([("muscle", ASCENDING), ("order", ASCENDING)]),
        IndexModel([("name", ASCENDING)]),
    ],
    "workouts": [
        IndexModel([("id", ASCENDING)], unique=True),
        IndexModel([("user_id", ASCENDING), ("muscle", ASCENDING), ("week_start", DESCENDING)]),
        IndexModel([("user_id", ASCENDING), ("status", ASCENDING), ("started_at", DESCENDING)]),
        IndexModel([("user_id", ASCENDING), ("date", DESCENDING)]),
    ],
    "plan_overrides": [
        IndexModel([("user_id", ASCENDING), ("muscle", ASCENDING)], unique=True, sparse=True),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                # Index zaten farklı isimle varsa veya başka bir sorun varsa
                # boot'u bloklamayalım, sadece log basalım.
                logger.warning("ensure_indexes(%s): %s", collection, exc)


async def migrate_to_multi_user() -> None:
    """Tek seferlik: eski 'default' profile'ı en eski kullanıcıya bağla,
    user_id'siz workout'ları ve plan_overrides'ları ona ata."""
    legacy = await db.profiles.find_one({"user_id": {"$exists": False}})
    if not legacy:
        return

    oldest = await db.users.find_one({}, sort=[("created_at", ASCENDING)])
    if not oldest:
        logger.warning("migrate_to_multi_user: no users found — skipping")
        return

    uid = oldest["id"]
    logger.info("Migrating legacy data to user %s (%s)", uid, oldest.get("email"))

    await db.profiles.update_one(
        {"_id": legacy["_id"]},
        {"$set": {"user_id": uid}, "$unset": {"id": ""}},
    )

    result = await db.workouts.update_many(
        {"user_id": {"$exists": False}},
        {"$set": {"user_id": uid}},
    )
    logger.info("Migrated %d workouts", result.modified_count)

    result = await db.plan_overrides.update_many(
        {"user_id": {"$exists": False}},
        {"$set": {"user_id": uid}},
    )
    logger.info("Migrated %d plan_overrides", result.modified_count)