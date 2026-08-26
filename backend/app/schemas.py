from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class OrderItemInput(BaseModel):
    product_id: str = Field(min_length=2, max_length=32)
    quantity: int = Field(gt=0, le=1000)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=150)
    customer_phone: str = Field(min_length=7, max_length=25)
    customer_address_text: str = Field(min_length=5, max_length=1000)
    items: list[OrderItemInput] = Field(min_length=1, max_length=100)

    @field_validator("customer_name", "customer_address_text")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("هذه الخانة مطلوبة")
        return value


class CreatedOrder(BaseModel):
    order_id: str
    order_number: str
    status: str
    total: Decimal


class OrderItemOutput(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class OrderOutput(BaseModel):
    order_id: str
    order_number: str
    customer_name: str
    customer_phone: str
    customer_address_text: str
    status: str
    total: Decimal
    created_at: datetime
    items: list[OrderItemOutput]
    assigned_supplier_name: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class AdminOrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(preparing|out_for_delivery|completed|cancelled)$")
    note: str | None = Field(default=None, max_length=500)


class SupplierCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    business_name: str = Field(min_length=2, max_length=200)


class SupplierOutput(BaseModel):
    supplier_id: int
    full_name: str
    business_name: str
    is_available: bool


class AssignSupplierRequest(BaseModel):
    supplier_id: int = Field(gt=0)
