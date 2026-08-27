from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Product
from app.models import User, UserRole
from app.config import get_settings
from app.security import hash_password


CATALOG = (
    ("mc1", "حليب كامل الدسم", "18.00"),
    ("mc2", "قشدة طازجة", "22.00"),
    ("ch1", "جبن شيدر", "40.00"),
    ("ch2", "جبن موتزاريلا", "35.00"),
    ("ln1", "لانشون بيتزا", "50.00"),
    ("ln2", "لانشون لحم مدخن", "45.00"),
    ("ln3", "لانشون كوردن بلو", "48.00"),
    ("ln4", "لانشون فراخ مدخن", "52.00"),
    ("ln5", "لانشون سجق", "47.00"),
    ("ln6", "لانشون بالفلفل الاسود", "46.00"),
    ("ln7", "لانشون ساده", "44.00"),
    ("ln8", "لانشون ديك رومى", "49.00"),
)


def seed_catalog(session: Session) -> None:
    """Populate the current storefront catalog only when a SKU is absent."""
    for sku, name_ar, price in CATALOG:
        if session.scalar(select(Product.id).where(Product.sku == sku)) is None:
            session.add(Product(sku=sku, name_ar=name_ar, unit_price=Decimal(price)))
    session.commit()


def seed_bootstrap_admin(session: Session) -> None:
    settings = get_settings()
    email = settings.bootstrap_admin_email.strip().lower()
    if session.scalar(select(User.id).where(User.email == email)) is None:
        session.add(User(email=email, full_name="مدير تلاجتى", password_hash=hash_password(settings.bootstrap_admin_password), role=UserRole.admin))
        session.commit()
