from pydantic import BaseModel


class CounterCreate(BaseModel):
    branch_id: int
    name: str
    counter_number: int
    service_id: int | None = None


class CounterResponse(BaseModel):
    id: int
    branch_id: int
    name: str
    counter_number: int
    service_id: int | None = None
    status: str
    current_queue_id: int | None

    class Config:
        from_attributes = True
