from pydantic import BaseModel


class JoinQueueRequest(BaseModel):
    branch_id: int
    service_id: int


class QueueResponse(BaseModel):
    id: int
    token_number: str
    branch_id: int
    service_id: int
    counter_id: int | None
    status: str
    queue_position: int
    estimated_wait: int

    class Config:
        from_attributes = True
