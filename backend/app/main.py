import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import Base, engine, SessionLocal
from app.api import (
    auth,
    equipment,
    telemetry,
    alerts,
    maintenance,
    analytics,
    diagnostics,
    simulator,
    health,
)
from app.seeds.seed_data import seed_database
from app.services.simulator_service import simulator_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("intellimaintain")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables are created and seed demo dataset if empty
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)

    # Seed demo data if database is fresh
    db = SessionLocal()
    try:
        from app.models.user import User
        if db.query(User).count() == 0:
            logger.info("Populating initial demonstration assets and users...")
            seed_database(db)
    except Exception as e:
        logger.error(f"Error during database startup check: {e}")
    finally:
        db.close()

    logger.info(f"{settings.PROJECT_NAME} v{settings.VERSION} online and ready.")
    yield

    # Shutdown: Stop any active background simulators safely
    logger.info("Shutting down background simulator tasks...")
    simulator_manager.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="IntelliMaintain — Intelligent Equipment Monitoring & Predictive Maintenance Platform API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please consult system logs."},
    )


# Include Routers
app.include_router(health.router)  # includes /health
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(equipment.router, prefix=settings.API_V1_STR)
app.include_router(telemetry.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(maintenance.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(diagnostics.router, prefix=settings.API_V1_STR)
app.include_router(simulator.router, prefix=settings.API_V1_STR)


@app.get("/")
def root_info():
    return {
        "platform": settings.PROJECT_NAME,
        "tagline": "Intelligent Equipment Monitoring & Predictive Maintenance",
        "version": settings.VERSION,
        "status": "online",
        "documentation": "/docs",
        "api_v1": settings.API_V1_STR,
    }
