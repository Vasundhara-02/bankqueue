from pydantic import BaseModel


class BranchCreate(BaseModel):
    name: str
    address: str
    phone: str | None = None


class BranchResponse(BaseModel):
    id: int
    name: str
    address: str
    phone: str | None
    is_active: bool

    class Config:
        from_attributes = True


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    average_service_time: int = 10


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: str | None
    average_service_time: int
    is_active: bool

    class Config:
        from_attributes = True


class BranchServiceCreate(BaseModel):
    branch_id: int
    service_id: int
