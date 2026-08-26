import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Customer, Order, OrderItem, OrderStatus, OrderStatusHistory, Product, Supplier, SupplierNotification, User, UserRole
from app.schemas import AdminOrderStatusUpdate, AssignSupplierRequest, CreatedOrder, OrderCreate, OrderItemOutput, OrderOutput, SupplierCreate, SupplierOutput
from app.security import hash_password


def normalize_phone(phone: str) -> str:
    normalized = re.sub(r"[^0-9+]", "", phone.strip())
    if normalized.startswith("00"):
        normalized = "+" + normalized[2:]
    if not re.fullmatch(r"\+?[0-9]{7,15}", normalized):
        raise HTTPException(status_code=422, detail="رقم الهاتف غير صحيح")
    return normalized


def create_order(db: Session, payload: OrderCreate) -> CreatedOrder:
    normalized_phone = normalize_phone(payload.customer_phone)
    quantities: dict[str, int] = {}
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    products = db.scalars(select(Product).where(Product.sku.in_(quantities), Product.is_active.is_(True))).all()
    products_by_sku = {product.sku: product for product in products}
    unavailable = sorted(set(quantities) - set(products_by_sku))
    if unavailable:
        raise HTTPException(status_code=422, detail="يوجد منتج غير متاح في الطلب")

    try:
        customer = db.scalar(select(Customer).where(Customer.phone_normalized == normalized_phone))
        if customer is None:
            customer = Customer(full_name=payload.customer_name, phone_normalized=normalized_phone, address=payload.customer_address_text)
            db.add(customer)
            db.flush()
        else:
            customer.full_name = payload.customer_name
            customer.address = payload.customer_address_text

        now = datetime.now(timezone.utc)
        order_number = f"TLG-{now:%Y%m%d}-{uuid.uuid4().hex[:8].upper()}"
        total = sum((product.unit_price * quantity for sku, quantity in quantities.items() for product in [products_by_sku[sku]]), Decimal("0.00"))
        order = Order(order_number=order_number, customer=customer, delivery_address=payload.customer_address_text, subtotal=total, total=total, status=OrderStatus.pending_assignment)
        db.add(order)
        db.flush()
        for sku, quantity in quantities.items():
            product = products_by_sku[sku]
            line_total = product.unit_price * quantity
            db.add(OrderItem(order=order, product_id=product.id, product_sku=product.sku, product_name_ar=product.name_ar, unit_price=product.unit_price, quantity=quantity, line_total=line_total))
        db.add(OrderStatusHistory(order=order, previous_status=None, new_status=OrderStatus.pending_assignment, note="تم إنشاء الطلب"))
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="تعذر حفظ الطلب. يرجى المحاولة لاحقاً")

    return CreatedOrder(order_id=order.public_id, order_number=order.order_number, status=order.status.value, total=order.total)


def list_orders_by_phone(db: Session, phone: str) -> list[OrderOutput]:
    normalized_phone = normalize_phone(phone)
    orders = db.scalars(select(Order).join(Order.customer).options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.assigned_supplier).selectinload(Supplier.user)).where(Customer.phone_normalized == normalized_phone).order_by(Order.created_at.desc())).all()
    return [
        serialize_order(order)
        for order in orders
    ]


def serialize_order(order: Order) -> OrderOutput:
    return OrderOutput(order_id=order.public_id, order_number=order.order_number, customer_name=order.customer.full_name, customer_phone=order.customer.phone_normalized, customer_address_text=order.delivery_address, status=order.status.value, total=order.total, created_at=order.created_at, assigned_supplier_name=order.assigned_supplier.user.full_name if order.assigned_supplier else None, items=[OrderItemOutput(product_id=item.product_sku, name=item.product_name_ar, quantity=item.quantity, unit_price=item.unit_price, line_total=item.line_total) for item in order.items])


def list_all_orders(db: Session) -> list[OrderOutput]:
    orders = db.scalars(select(Order).options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.assigned_supplier).selectinload(Supplier.user)).order_by(Order.created_at.desc())).all()
    return [serialize_order(order) for order in orders]


def update_order_status(db: Session, public_id: str, payload: AdminOrderStatusUpdate) -> OrderOutput:
    order = db.scalar(select(Order).options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.assigned_supplier).selectinload(Supplier.user)).where(Order.public_id == public_id))
    if order is None:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    requested_status = OrderStatus(payload.status)
    transitions = {
        OrderStatus.pending_assignment: {OrderStatus.preparing, OrderStatus.cancelled},
        OrderStatus.preparing: {OrderStatus.out_for_delivery, OrderStatus.cancelled},
        OrderStatus.out_for_delivery: {OrderStatus.completed},
        OrderStatus.completed: set(),
        OrderStatus.cancelled: set(),
    }
    if requested_status not in transitions[order.status]:
        raise HTTPException(status_code=409, detail="لا يمكن تنفيذ هذا الانتقال لحالة الطلب")
    previous_status = order.status
    order.status = requested_status
    db.add(OrderStatusHistory(order=order, previous_status=previous_status, new_status=requested_status, note=payload.note))
    db.commit()
    db.refresh(order)
    return serialize_order(order)


def create_supplier(db: Session, payload: SupplierCreate) -> SupplierOutput:
    email = payload.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=409, detail="البريد الإلكتروني مستخدم بالفعل")
    try:
        user = User(email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password), role=UserRole.supplier)
        supplier = Supplier(user=user, business_name=payload.business_name.strip())
        db.add(supplier)
        db.commit()
        db.refresh(supplier)
        return SupplierOutput(supplier_id=supplier.id, full_name=user.full_name, business_name=supplier.business_name, is_available=supplier.is_available)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="تعذر إنشاء حساب المورد")


def list_suppliers(db: Session) -> list[SupplierOutput]:
    suppliers = db.scalars(select(Supplier).options(selectinload(Supplier.user)).order_by(Supplier.business_name)).all()
    return [SupplierOutput(supplier_id=supplier.id, full_name=supplier.user.full_name, business_name=supplier.business_name, is_available=supplier.is_available) for supplier in suppliers]


def assign_supplier(db: Session, public_id: str, payload: AssignSupplierRequest) -> OrderOutput:
    order = db.scalar(select(Order).options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.assigned_supplier).selectinload(Supplier.user)).where(Order.public_id == public_id))
    if order is None:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    if order.status != OrderStatus.pending_assignment:
        raise HTTPException(status_code=409, detail="لا يمكن إعادة تعيين هذا الطلب بعد بدء التجهيز")
    supplier = db.scalar(select(Supplier).options(selectinload(Supplier.user)).where(Supplier.id == payload.supplier_id, Supplier.is_available.is_(True)))
    if supplier is None:
        raise HTTPException(status_code=422, detail="المورد غير متاح")
    try:
        order.assigned_supplier = supplier
        order.status = OrderStatus.preparing
        db.add(OrderStatusHistory(order=order, previous_status=OrderStatus.pending_assignment, new_status=OrderStatus.preparing, note=f"تم إسناد الطلب إلى {supplier.business_name}"))
        db.add(SupplierNotification(supplier_id=supplier.id, order_id=order.id, message_ar=f"تم إسناد الطلب {order.order_number} إليك"))
        db.commit()
        db.refresh(order)
        return serialize_order(order)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="تعذر إسناد الطلب للمورد")


def list_supplier_orders(db: Session, supplier_user_id: int) -> list[OrderOutput]:
    supplier = db.scalar(select(Supplier).where(Supplier.user_id == supplier_user_id))
    if supplier is None:
        raise HTTPException(status_code=403, detail="حساب المورد غير مكتمل")
    orders = db.scalars(select(Order).options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.assigned_supplier).selectinload(Supplier.user)).where(Order.assigned_supplier_id == supplier.id).order_by(Order.created_at.desc())).all()
    return [serialize_order(order) for order in orders]
