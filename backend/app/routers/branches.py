from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Branch, Service, BranchService
from app.schemas.branch import (
    BranchCreate,
    BranchResponse,
    ServiceCreate,
    ServiceResponse,
    BranchServiceCreate,
)

router = APIRouter(
    prefix="/branches",
    tags=["Branches & Services"]
)


@router.post(
    "",
    response_model=BranchResponse,
    status_code=201
)
def create_branch(
    data: BranchCreate,
    db: Session = Depends(get_db)
):
    branch = Branch(
        name=data.name,
        address=data.address,
        phone=data.phone
    )

    db.add(branch)
    db.commit()
    db.refresh(branch)

    return branch


@router.get(
    "",
    response_model=list[BranchResponse]
)
def get_branches(
    db: Session = Depends(get_db)
):
    return db.query(Branch).filter(
        Branch.is_active == True
    ).all()


@router.get(
    "/{branch_id}",
    response_model=BranchResponse
)
def get_branch(
    branch_id: int,
    db: Session = Depends(get_db)
):
    branch = db.query(Branch).filter(
        Branch.id == branch_id
    ).first()

    if not branch:
        raise HTTPException(
            status_code=404,
            detail="Branch not found"
        )

    return branch


@router.post(
    "/services",
    status_code=201
)
def create_service(
    data: ServiceCreate,
    db: Session = Depends(get_db)
):
    service = Service(
        name=data.name,
        description=data.description,
        average_service_time=data.average_service_time
    )

    db.add(service)
    db.commit()
    db.refresh(service)

    return service


@router.get(
    "/services/all",
    response_model=list[ServiceResponse]
)
def get_services(
    db: Session = Depends(get_db)
):
    return db.query(Service).filter(
        Service.is_active == True
    ).all()


@router.post(
    "/services/assign",
    status_code=201
)
def assign_service_to_branch(
    data: BranchServiceCreate,
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

    service = db.query(Service).filter(
        Service.id == data.service_id
    ).first()

    if not service:
        raise HTTPException(
            status_code=404,
            detail="Service not found"
        )

    existing = db.query(BranchService).filter(
        BranchService.branch_id == data.branch_id,
        BranchService.service_id == data.service_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Service already assigned to this branch"
        )

    branch_service = BranchService(
        branch_id=data.branch_id,
        service_id=data.service_id
    )

    db.add(branch_service)
    db.commit()
    db.refresh(branch_service)

    return {
        "message": "Service assigned to branch",
        "branch_id": branch_service.branch_id,
        "service_id": branch_service.service_id
    }


@router.get(
    "/{branch_id}/services",
    response_model=list[ServiceResponse]
)
def get_branch_services(
    branch_id: int,
    db: Session = Depends(get_db)
):
    branch = db.query(Branch).filter(
        Branch.id == branch_id
    ).first()

    if not branch:
        raise HTTPException(
            status_code=404,
            detail="Branch not found"
        )

    services = (
        db.query(Service)
        .join(
            BranchService,
            BranchService.service_id == Service.id
        )
        .filter(
            BranchService.branch_id == branch_id,
            Service.is_active == True
        )
        .all()
    )

    return services
