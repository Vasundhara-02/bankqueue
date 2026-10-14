from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Branch, Service, BranchService, QueueEntry
from app.dependencies import get_current_user
from app.schemas.queue import JoinQueueRequest, QueueResponse
from app.services.websocket_manager import manager

router = APIRouter(
    prefix="/queue",
    tags=["Queue"]
)


def generate_token(db: Session):
    today = datetime.now().strftime("%Y%m%d")

    count = db.query(QueueEntry).filter(
        QueueEntry.token_number.like(f"BQ-{today}-%")
    ).count()

    return f"BQ-{today}-{count + 1:03d}"


@router.post(
    "/join",
    response_model=QueueResponse,
    status_code=201
)

async def join_queue(
    data: JoinQueueRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    branch = db.query(Branch).filter(
        Branch.id == data.branch_id,
        Branch.is_active == True
    ).first()

    if not branch:
        raise HTTPException(
            status_code=404,
            detail="Branch not found"
        )

    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.is_active == True
    ).first()

    if not service:
        raise HTTPException(
            status_code=404,
            detail="Service not found"
        )

    branch_service = db.query(BranchService).filter(
        BranchService.branch_id == data.branch_id,
        BranchService.service_id == data.service_id
    ).first()

    if not branch_service:
        raise HTTPException(
            status_code=400,
            detail="This service is not available at this branch"
        )

    active_queue = db.query(QueueEntry).filter(
        QueueEntry.user_id == current_user.id,
        QueueEntry.branch_id == data.branch_id,
        QueueEntry.status.in_([
            "waiting",
            "called",
            "serving"
        ])
    ).first()

    if active_queue:
        raise HTTPException(
            status_code=400,
            detail="You already have an active queue token"
        )

    position = db.query(QueueEntry).filter(
        QueueEntry.branch_id == data.branch_id,
        QueueEntry.service_id == data.service_id,
        QueueEntry.status == "waiting"
    ).count() + 1

    estimated_wait = (
        (position - 1) * service.average_service_time
    )

    token = generate_token(db)

    queue_entry = QueueEntry(
        token_number=token,
        user_id=current_user.id,
        branch_id=data.branch_id,
        service_id=data.service_id,
        status="waiting",
        queue_position=position,
        estimated_wait=estimated_wait
    )

    db.add(queue_entry)
    db.commit()
    db.refresh(queue_entry)

    await manager.broadcast({
        "type": "queue_update",
        "action": "joined",
        "token_number": queue_entry.token_number,
        "queue_id": queue_entry.id,
        "branch_id": queue_entry.branch_id,
        "service_id": queue_entry.service_id,
        "status": queue_entry.status,
        "queue_position": queue_entry.queue_position,
        "estimated_wait": queue_entry.estimated_wait
    })

    return queue_entry

@router.get(
"/my-active",
response_model=QueueResponse | None
)
def get_my_active_queue(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(QueueEntry).filter(
        QueueEntry.user_id == current_user.id,
        QueueEntry.status.in_([
            "waiting",
            "called",
            "serving"
        ])
    )

    if branch_id is not None:
        query = query.filter(
            QueueEntry.branch_id == branch_id
        )

    return query.order_by(
        QueueEntry.joined_at.desc()
    ).first()


@router.get(
    "/status/{token_number}",
    response_model=QueueResponse

)
def queue_status(
    token_number: str,
    db: Session = Depends(get_db)
):
    queue = db.query(QueueEntry).filter(
        QueueEntry.token_number == token_number
    ).first()

    if not queue:
        raise HTTPException(
            status_code=404,
            detail="Queue token not found"
        )

    if queue.status == "waiting":

        position = db.query(QueueEntry).filter(
            QueueEntry.branch_id == queue.branch_id,
            QueueEntry.service_id == queue.service_id,
            QueueEntry.status == "waiting",
            QueueEntry.id <= queue.id
        ).count()

        service = db.query(Service).filter(
            Service.id == queue.service_id
        ).first()

        queue.queue_position = position

        queue.estimated_wait = (
            (position - 1) * service.average_service_time
        )

        db.commit()
        db.refresh(queue)

    return queue


@router.get(
    "/branch/{branch_id}",
    response_model=list[QueueResponse]
)
def get_branch_queue(
    branch_id: int,
    db: Session = Depends(get_db)
):
    entries = db.query(QueueEntry).filter(
        QueueEntry.branch_id == branch_id,
        QueueEntry.status.in_([
            "waiting",
            "called",
            "serving"
        ])
    ).order_by(
        QueueEntry.joined_at.asc()
    ).all()

    result = []

    for entry in entries:
        position = entry.queue_position
        estimated_wait = entry.estimated_wait

        if entry.status == "waiting":
            earlier_waiting = db.query(QueueEntry).filter(
                QueueEntry.branch_id == entry.branch_id,
                QueueEntry.service_id == entry.service_id,
                QueueEntry.status == "waiting",
                QueueEntry.joined_at < entry.joined_at
            ).count()

            position = earlier_waiting + 1

            service = db.query(Service).filter(
                Service.id == entry.service_id
            ).first()

            if service:
                estimated_wait = (
                    earlier_waiting * service.average_service_time
                )

        result.append({
            "id": entry.id,
            "token_number": entry.token_number,
            "branch_id": entry.branch_id,
            "service_id": entry.service_id,
            "counter_id": entry.counter_id,
            "status": entry.status,
            "queue_position": position,
            "estimated_wait": estimated_wait
        })

    return result

@router.post(
    "/cancel/{token_number}",
    response_model=QueueResponse
)
async def cancel_queue(
    token_number: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    queue = db.query(QueueEntry).filter(
        QueueEntry.token_number == token_number
    ).first()

    if not queue:
        raise HTTPException(
            status_code=404,
            detail="Queue token not found"
        )

    # Only the customer who owns the token can cancel it
    if queue.user_id != current_user.id and current_user.role != "staff":
        raise HTTPException(
            status_code=403,
            detail="You cannot cancel another customer's token"
        )

    if queue.status not in ["waiting", "called"]:
        raise HTTPException(
            status_code=400,
            detail="Queue cannot be cancelled in its current state"
        )

    queue.status = "cancelled"
    queue.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(queue)

    await manager.broadcast({
        "type": "queue_update",
        "action": "cancelled",
        "token_number": queue.token_number,
        "queue_id": queue.id,
        "branch_id": queue.branch_id,
        "service_id": queue.service_id,
        "status": queue.status,
        "queue_position": queue.queue_position,
        "estimated_wait": queue.estimated_wait
    })

    return queue
