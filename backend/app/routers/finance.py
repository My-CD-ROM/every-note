from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    BalanceEntry,
    IncomeEntry,
    MeterReading,
    SpendingCategory,
    SpendingEntry,
    UtilityAddress,
    generate_ulid,
    utc_now,
)
from app.schemas import (
    BalanceEntryCreate,
    BalanceEntryResponse,
    BalanceEntryUpdate,
    IncomeEntryResponse,
    IncomeEntryUpsert,
    MeterReadingResponse,
    MeterReadingUpsert,
    SpendingCategoryCreate,
    SpendingCategoryResponse,
    SpendingCategoryUpdate,
    SpendingEntryResponse,
    SpendingEntryUpsert,
    UtilityAddressCreate,
    UtilityAddressResponse,
    UtilityAddressUpdate,
)

router = APIRouter(prefix="/finance", tags=["finance"])
S = Annotated[Session, Depends(get_session)]


# -- Spending Categories --


@router.get("/spending-categories", response_model=list[SpendingCategoryResponse])
def list_spending_categories(session: S):
    cats = session.exec(
        select(SpendingCategory).order_by(SpendingCategory.position)
    ).all()
    return cats


@router.post("/spending-categories", response_model=SpendingCategoryResponse, status_code=201)
def create_spending_category(data: SpendingCategoryCreate, session: S):
    cat = SpendingCategory(
        id=generate_ulid(),
        name=data.name,
        created_at=utc_now(),
    )
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.patch("/spending-categories/{cat_id}", response_model=SpendingCategoryResponse)
def update_spending_category(cat_id: str, data: SpendingCategoryUpdate, session: S):
    cat = session.get(SpendingCategory, cat_id)
    if not cat:
        raise HTTPException(404, "Spending category not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/spending-categories/{cat_id}")
def delete_spending_category(cat_id: str, session: S):
    cat = session.get(SpendingCategory, cat_id)
    if not cat:
        raise HTTPException(404, "Spending category not found")
    entries = session.exec(
        select(SpendingEntry).where(SpendingEntry.category_id == cat_id)
    ).all()
    for e in entries:
        session.delete(e)
    session.delete(cat)
    session.commit()
    return {"ok": True}


# -- Spending Entries --


@router.get("/spending-entries", response_model=list[SpendingEntryResponse])
def list_spending_entries(session: S, year: int = Query(...)):
    entries = session.exec(
        select(SpendingEntry).where(SpendingEntry.year == year)
    ).all()
    return entries


@router.put("/spending-entries", response_model=SpendingEntryResponse)
def upsert_spending_entry(data: SpendingEntryUpsert, session: S):
    existing = session.exec(
        select(SpendingEntry).where(
            SpendingEntry.category_id == data.category_id,
            SpendingEntry.year == data.year,
            SpendingEntry.month == data.month,
        )
    ).first()
    if existing:
        existing.amount = data.amount
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    entry = SpendingEntry(
        id=generate_ulid(),
        category_id=data.category_id,
        year=data.year,
        month=data.month,
        amount=data.amount,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


# -- Income --


@router.get("/income", response_model=list[IncomeEntryResponse])
def list_income(session: S, year: int = Query(...)):
    entries = session.exec(
        select(IncomeEntry).where(IncomeEntry.year == year)
    ).all()
    return entries


@router.put("/income", response_model=IncomeEntryResponse)
def upsert_income(data: IncomeEntryUpsert, session: S):
    existing = session.exec(
        select(IncomeEntry).where(
            IncomeEntry.year == data.year,
            IncomeEntry.month == data.month,
        )
    ).first()
    if existing:
        existing.gross = data.gross
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    entry = IncomeEntry(
        id=generate_ulid(),
        year=data.year,
        month=data.month,
        gross=data.gross,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


# -- Utility Addresses --


@router.get("/utility-addresses", response_model=list[UtilityAddressResponse])
def list_utility_addresses(session: S):
    addrs = session.exec(
        select(UtilityAddress).order_by(UtilityAddress.position)
    ).all()
    return addrs


@router.post("/utility-addresses", response_model=UtilityAddressResponse, status_code=201)
def create_utility_address(data: UtilityAddressCreate, session: S):
    addr = UtilityAddress(
        id=generate_ulid(),
        name=data.name,
        created_at=utc_now(),
    )
    session.add(addr)
    session.commit()
    session.refresh(addr)
    return addr


@router.patch("/utility-addresses/{addr_id}", response_model=UtilityAddressResponse)
def update_utility_address(addr_id: str, data: UtilityAddressUpdate, session: S):
    addr = session.get(UtilityAddress, addr_id)
    if not addr:
        raise HTTPException(404, "Utility address not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(addr, k, v)
    session.add(addr)
    session.commit()
    session.refresh(addr)
    return addr


@router.delete("/utility-addresses/{addr_id}")
def delete_utility_address(addr_id: str, session: S):
    addr = session.get(UtilityAddress, addr_id)
    if not addr:
        raise HTTPException(404, "Utility address not found")
    readings = session.exec(
        select(MeterReading).where(MeterReading.address_id == addr_id)
    ).all()
    for r in readings:
        session.delete(r)
    session.delete(addr)
    session.commit()
    return {"ok": True}


# -- Meter Readings --


@router.get("/meter-readings", response_model=list[MeterReadingResponse])
def list_meter_readings(session: S, year: int = Query(...)):
    """Returns readings for the given year AND December of previous year
    (needed for January consumption delta)."""
    readings = session.exec(
        select(MeterReading).where(
            ((MeterReading.year == year))
            | ((MeterReading.year == year - 1) & (MeterReading.month == 12))
        )
    ).all()
    return readings


@router.put("/meter-readings", response_model=MeterReadingResponse)
def upsert_meter_reading(data: MeterReadingUpsert, session: S):
    existing = session.exec(
        select(MeterReading).where(
            MeterReading.address_id == data.address_id,
            MeterReading.utility_type == data.utility_type,
            MeterReading.year == data.year,
            MeterReading.month == data.month,
        )
    ).first()
    if existing:
        existing.reading = data.reading
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    reading = MeterReading(
        id=generate_ulid(),
        address_id=data.address_id,
        utility_type=data.utility_type,
        year=data.year,
        month=data.month,
        reading=data.reading,
    )
    session.add(reading)
    session.commit()
    session.refresh(reading)
    return reading


# -- Balance --


@router.get("/balance-entries", response_model=list[BalanceEntryResponse])
def list_balance_entries(session: S):
    entries = session.exec(
        select(BalanceEntry).order_by(BalanceEntry.position)
    ).all()
    return entries


@router.post("/balance-entries", response_model=BalanceEntryResponse, status_code=201)
def create_balance_entry(data: BalanceEntryCreate, session: S):
    entry = BalanceEntry(
        id=generate_ulid(),
        name=data.name,
        created_at=utc_now(),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.patch("/balance-entries/{entry_id}", response_model=BalanceEntryResponse)
def update_balance_entry(entry_id: str, data: BalanceEntryUpdate, session: S):
    entry = session.get(BalanceEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Balance entry not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/balance-entries/{entry_id}")
def delete_balance_entry(entry_id: str, session: S):
    entry = session.get(BalanceEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Balance entry not found")
    session.delete(entry)
    session.commit()
    return {"ok": True}
