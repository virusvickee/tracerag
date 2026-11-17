from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import init_db
from app.db.seed_demo import seed_demo_workspace
from app.api.routes import experiments, workspaces


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_demo_workspace()
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspaces.router, prefix=settings.API_V1_STR)
app.include_router(experiments.router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "tracerag-backend"}
