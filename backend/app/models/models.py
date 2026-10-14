from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="customer", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    queue_entries = relationship(
        "QueueEntry",
        back_populates="user"
    )

    appointments = relationship(
        "Appointment",
        back_populates="user"
    )


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    address = Column(Text, nullable=False)
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    counters = relationship(
        "Counter",
        back_populates="branch"
    )

    services = relationship(
        "BranchService",
        back_populates="branch"
    )

    queue_entries = relationship(
        "QueueEntry",
        back_populates="branch"
    )


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    average_service_time = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)

    branches = relationship(
        "BranchService",
        back_populates="service"
    )

    queue_entries = relationship(
        "QueueEntry",
        back_populates="service"
    )

    appointments = relationship(
        "Appointment",
        back_populates="service"
    )


class BranchService(Base):
    __tablename__ = "branch_services"

    id = Column(Integer, primary_key=True, index=True)

    branch_id = Column(
        Integer,
        ForeignKey("branches.id"),
        nullable=False
    )

    service_id = Column(
        Integer,
        ForeignKey("services.id"),
        nullable=False
    )

    branch = relationship(
        "Branch",
        back_populates="services"
    )

    service = relationship(
        "Service",
        back_populates="branches"
    )


class Counter(Base):
    __tablename__ = "counters"

    id = Column(Integer, primary_key=True, index=True)

    branch_id = Column(
        Integer,
        ForeignKey("branches.id"),
        nullable=False
    )

    name = Column(String(50), nullable=False)
    counter_number = Column(Integer, nullable=False)

    service_id = Column(
        Integer,
        ForeignKey("services.id"),
        nullable=True
    )

    status = Column(String(30), default="available")
    current_queue_id = Column(Integer, nullable=True)

    service = relationship("Service")

    branch = relationship(
        "Branch",
        back_populates="counters"
    )


class QueueEntry(Base):
    __tablename__ = "queue_entries"

    id = Column(Integer, primary_key=True, index=True)

    token_number = Column(String(30), unique=True, nullable=False, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    branch_id = Column(
        Integer,
        ForeignKey("branches.id"),
        nullable=False
    )

    service_id = Column(
        Integer,
        ForeignKey("services.id"),
        nullable=False
    )

    counter_id = Column(
        Integer,
        ForeignKey("counters.id"),
        nullable=True
    )

    status = Column(
        String(30),
        default="waiting",
        nullable=False
    )

    queue_position = Column(Integer, nullable=False)

    estimated_wait = Column(Integer, default=0)

    joined_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    called_at = Column(
        DateTime,
        nullable=True
    )

    service_started_at = Column(
        DateTime,
        nullable=True
    )

    completed_at = Column(
        DateTime,
        nullable=True
    )

    user = relationship(
        "User",
        back_populates="queue_entries"
    )

    branch = relationship(
        "Branch",
        back_populates="queue_entries"
    )

    service = relationship(
        "Service",
        back_populates="queue_entries"
    )


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)

    appointment_number = Column(
        String(30),
        unique=True,
        nullable=False,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    service_id = Column(
        Integer,
        ForeignKey("services.id"),
        nullable=False
    )

    branch_id = Column(
        Integer,
        ForeignKey("branches.id"),
        nullable=False
    )

    appointment_date = Column(
        DateTime,
        nullable=False
    )

    status = Column(
        String(30),
        default="booked",
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    user = relationship(
        "User",
        back_populates="appointments"
    )

    service = relationship(
        "Service",
        back_populates="appointments"
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )
