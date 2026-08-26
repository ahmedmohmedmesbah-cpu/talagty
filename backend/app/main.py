from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine, get_db
from app.schemas import AdminOrderStatusUpdate, AssignSupplierRequest, CreatedOrder, LoginRequest, LoginResponse, OrderCreate, OrderOutput, SupplierCreate, SupplierOutput
from app.seed import seed_bootstrap_admin, seed_catalog
from app.security import issue_access_token, require_admin, require_supplier, verify_password
from app.models import User
from app.services import assign_supplier, create_order, create_supplier, list_all_orders, list_orders_by_phone, list_supplier_orders, list_suppliers, update_order_status


@asynccontextmanager
async def lifespan(_: FastAPI):
    # For local development. Production must apply sql/001_initial_schema.sql first.
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_catalog(session)
        seed_bootstrap_admin(session)
    yield


app = FastAPI(title="Tallagty Order API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins, allow_credentials=False, allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type", "Authorization"])


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/orders", response_model=CreatedOrder, status_code=201)
def submit_order(payload: OrderCreate, db: Session = Depends(get_db)) -> CreatedOrder:
    return create_order(db, payload)


@app.get("/api/orders", response_model=list[OrderOutput])
def get_customer_orders(phone: str, db: Session = Depends(get_db)) -> list[OrderOutput]:
    return list_orders_by_phone(db, phone)


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="بيانات الدخول غير صحيحة")
    return LoginResponse(access_token=issue_access_token(user), role=user.role.value)


@app.get("/api/admin/orders", response_model=list[OrderOutput])
def admin_orders(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[OrderOutput]:
    return list_all_orders(db)


@app.patch("/api/admin/orders/{public_id}/status", response_model=OrderOutput)
def admin_update_order_status(public_id: str, payload: AdminOrderStatusUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> OrderOutput:
    return update_order_status(db, public_id, payload)


@app.get("/api/admin/suppliers", response_model=list[SupplierOutput])
def admin_suppliers(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[SupplierOutput]:
    return list_suppliers(db)


@app.post("/api/admin/suppliers", response_model=SupplierOutput, status_code=201)
def admin_create_supplier(payload: SupplierCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> SupplierOutput:
    return create_supplier(db, payload)


@app.patch("/api/admin/orders/{public_id}/assignment", response_model=OrderOutput)
def admin_assign_supplier(public_id: str, payload: AssignSupplierRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> OrderOutput:
    return assign_supplier(db, public_id, payload)


@app.get("/api/supplier/orders", response_model=list[OrderOutput])
def supplier_orders(user: User = Depends(require_supplier), db: Session = Depends(get_db)) -> list[OrderOutput]:
    return list_supplier_orders(db, user.id)
