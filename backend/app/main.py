from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app import models
from app.routes.ledger import router as ledger_router
from app.routes.gst import router as gst_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they do not exist
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="STACKLY FICO - General Ledger & GST",
    description="General Ledger & GST Module API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "STACKLY FICO - General Ledger & GST Backend is Running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "modules": ["General Ledger", "GST"]
    }


app.include_router(ledger_router)
app.include_router(gst_router)
