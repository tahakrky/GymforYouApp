import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from lib.db import client, db, ensure_indexes, migrate_to_multi_user


class _SkipAuthFailures(logging.Filter):
    """Uvicorn access log'unda 401/403 yanıtlarını gizle."""
    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 5:
            if args[-1] in (401, 403):
                return False
        return True


logging.getLogger("uvicorn.access").addFilter(_SkipAuthFailures())


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    # Tek seferlik migration — eski 'default' profile'ı en eski kullanıcıya bağla
    try:
        await migrate_to_multi_user()
    except Exception as exc:
        logging.getLogger(__name__).error("migrate_to_multi_user failed: %s", exc)
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# Resource routers — her biri /api prefix'i altında
from routers import auth as auth_router
from routers import admin as admin_router
from routers import exercises as exercises_router
from routers import profile as profile_router
from routers import summary as summary_router
from routers import workouts as workouts_router

api_router.include_router(auth_router.router)
api_router.include_router(admin_router.router)
api_router.include_router(profile_router.router)
api_router.include_router(exercises_router.router)
api_router.include_router(workouts_router.router)
api_router.include_router(summary_router.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)