from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Branch, Counter, QueueEntry
from app.services.websocket_manager import manager
from app.dependencies import get_current_staff

from app.schemas.counter import (
    CounterCreate,
    CounterResponse
)

router = APIRouter(
    prefix="/counters",
    tags=["Counters & Staff"]
)


@router.post(
    "",
    response_model=CounterResponse,
    status_code=201
)
def create_counter(
    data: CounterCreate,
    db: Session = Depends(get_db)
):
    branch = db.query(Branch).filter(
        Branch.id == data.branch_id
    ).first()

    if not branch:
        raise HTTPException(
            status_code=404,
            detail="Branch not found"
        )

    counter = Counter(
        branch_id=data.branch_id,
        name=data.name,
        counter_number=data.counter_number,
        service_id=data.service_id,
        status="available"
    )

    db.add(counter)
    db.commit()
    db.refresh(counter)

    return counter


@router.get(
    "/branch/{branch_id}",
    response_model=list[CounterResponse]
)
def get_counters(
    branch_id: int,
    db: Session = Depends(get_db)
):
    return db.query(Counter).filter(
        Counter.branch_id == branch_id
    ).order_by(
        Counter.counter_number
    ).all()

@router.post(
    "/{counter_id}/call-next",
    response_model=dict
)
async def call_next(
    counter_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_staff)
):
    counter = db.query(Counter).filter(
        Counter.id == counter_id
    ).first()

    if not counter:
        raise HTTPException(
            status_code=404,
            detail="Counter not found"
        )

    if counter.status != "available":
        raise HTTPException(
            status_code=400,
            detail="Counter is currently busy"
        )

    queue_query = db.query(QueueEntry).filter(
        QueueEntry.branch_id == counter.branch_id,
        QueueEntry.status == "waiting"
    )

    if counter.service_id is not None:
        queue_query = queue_query.filter(
            QueueEntry.service_id == counter.service_id
        )

    queue = queue_query.order_by(
        QueueEntry.joined_at.asc(),
        QueueEntry.id.asc()
    ).first()

    if not queue:
        raise HTTPException(
            status_code=404,
            detail="No customers waiting"
        )

    queue.status = "called"
    queue.counter_id = counter.id
    queue.called_at = datetime.utcnow()

    counter.status = "busy"
    counter.current_queue_id = queue.id

    db.commit()
    db.refresh(queue)
    db.refresh(counter)

    await manager.broadcast({
        "type": "queue_update",
        "action": "called",
        "token_number": queue.token_number,
        "queue_id": queue.id,
        "branch_id": queue.branch_id,
        "service_id": queue.service_id,
        "counter_id": counter.id,
        "status": queue.status
    })

    return {
        "message": "Customer called successfully",
        "token_number": queue.token_number,
        "queue_id": queue.id,
        "counter_id": counter.id,
        "status": queue.status
    }

@router.post(
    "/{counter_id}/start-serving",
    response_model=dict
)
async def start_serving(
    counter_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_staff)
):
    counter = db.query(Counter).filter(
        Counter.id == counter_id
    ).first()

    if not counter:
        raise HTTPException(
            status_code=404,
            detail="Counter not found"
        )

    if not counter.current_queue_id:
        raise HTTPException(
            status_code=400,
            detail="No customer assigned to this counter"
        )

    queue = db.query(QueueEntry).filter(
        QueueEntry.id == counter.current_queue_id
    ).first()

    if not queue:
        raise HTTPException(
            status_code=404,
            detail="Queue entry not found"
        )

    if queue.status != "called":
        raise HTTPException(
            status_code=400,
            detail="Customer must be called before serving"
        )

    queue.status = "serving"
    queue.service_started_at = datetime.utcnow()

    db.commit()
    db.refresh(queue)

    await manager.broadcast({
        "type": "queue_update",
        "action": "serving",
        "token_number": queue.token_number,
        "queue_id": queue.id,
        "branch_id": queue.branch_id,
        "service_id": queue.service_id,
        "counter_id": counter.id,
        "status": queue.status
    })

    return {
        "message": "Service started successfully",
        "token_number": queue.token_number,
        "counter_id": counter.id,
        "status": queue.status
    }

@router.post(
    "/{counter_id}/complete",
    response_model=dict
)
async def complete_service(
    counter_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_staff)

):
    counter = db.query(Counter).filter(
        Counter.id == counter_id
    ).first()

    if not counter:
        raise HTTPException(
            status_code=404,
            detail="Counter not found"
        )

    if not counter.current_queue_id:
        raise HTTPException(
            status_code=400,
            detail="No customer assigned to this counter"
        )

    queue = db.query(QueueEntry).filter(
        QueueEntry.id == counter.current_queue_id
    ).first()

    if not queue:
        raise HTTPException(
            status_code=404,
            detail="Queue entry not found"
        )

    if queue.status != "serving":
        raise HTTPException(
            status_code=400,
            detail="Customer must be serving before completion"
        )

    queue.status = "completed"
    queue.completed_at = datetime.utcnow()

    counter.status = "available"
    counter.current_queue_id = None

    db.commit()
    db.refresh(queue)

    await manager.broadcast({
        "type": "queue_update",
        "action": "completed",
        "token_number": queue.token_number,
        "queue_id": queue.id,
        "branch_id": queue.branch_id,
        "service_id": queue.service_id,
        "counter_id": counter.id,
        "status": queue.status
    })

    return {
        "message": "Service completed successfully",
        "token_number": queue.token_number,
        "counter_id": counter.id,
        "status": queue.status
    }

@router.post(
    "/{counter_id}/skip",
    response_model=dict
)
async def skip_customer(
    counter_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_staff)
):
    counter = db.query(Counter).filter(
        Counter.id == counter_id
    ).first()

    if not counter:
        raise HTTPException(
            status_code=404,
            detail="Counter not found"
        )

    if not counter.current_queue_id:
        raise HTTPException(
            status_code=400,
            detail="No customer assigned to this counter"
        )

    queue = db.query(QueueEntry).filter(
        QueueEntry.id == counter.current_queue_id
    ).first()

    if not queue:
        raise HTTPException(
            status_code=404,
            detail="Queue entry not found"
        )

    queue.status = "skipped"
    queue.completed_at = datetime.utcnow()

    counter.status = "available"
    counter.current_queue_id = None

    db.commit()
    db.refresh(queue)

    await manager.broadcast({
        "type": "queue_update",
        "action": "skipped",
        "token_number": queue.token_number,
        "queue_id": queue.id,
        "branch_id": queue.branch_id,
        "service_id": queue.service_id,
        "counter_id": counter.id,
        "status": queue.status
    })

    return {
        "message": "Customer skipped successfully",
        "token_number": queue.token_number,
        "counter_id": counter.id,
        "status": queue.status
    }
