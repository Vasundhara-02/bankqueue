from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from app.services.websocket_manager import manager

from app.database import Base, engine
from app.models import (
    User,
    Branch,
    Service,
    BranchService,
    Counter,
    QueueEntry,
    Appointment,
    Notification,
)
from app.routers.auth import router as auth_router
from app.routers.branches import router as branches_router
from app.routers.queue import router as queue_router
from app.routers.counters import router as counters_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BankQueue API",
    description="Smart Bank Queue and Appointment Management System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(branches_router)
app.include_router(queue_router)
app.include_router(counters_router)


@app.get("/")
def root():
    return {
        "message": "BankQueue API is running",
        "status": "success"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

@app.websocket("/ws/queue")
async def queue_websocket(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
