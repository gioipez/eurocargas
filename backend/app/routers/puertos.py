from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/puertos", tags=["puertos"])


@router.get("", response_model=list[schemas.PuertoOut])
def listar_puertos(db: Session = Depends(get_db)):
    return db.query(models.Puerto).order_by(models.Puerto.nombre).all()


@router.post("", response_model=schemas.PuertoOut, status_code=201)
def crear_puerto(payload: schemas.PuertoCreate, db: Session = Depends(get_db)):
    duplicado = (
        db.query(models.Puerto)
        .filter(func.lower(models.Puerto.nombre) == payload.nombre.lower())
        .first()
    )
    if duplicado:
        raise HTTPException(status_code=409, detail=f"Ya existe el puerto '{duplicado.nombre}'")
    puerto = models.Puerto(**payload.model_dump())
    db.add(puerto)
    try:
        db.commit()
    except IntegrityError:  # código duplicado (único)
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Ya existe un puerto con código '{payload.codigo}'")
    db.refresh(puerto)
    return puerto


@router.delete("/{puerto_id}", status_code=204)
def eliminar_puerto(puerto_id: int, db: Session = Depends(get_db)):
    puerto = db.get(models.Puerto, puerto_id)
    if not puerto:
        raise HTTPException(status_code=404, detail="Puerto no encontrado")
    en_uso = (
        db.query(models.Item)
        .filter(or_(models.Item.origen == puerto.nombre, models.Item.destino == puerto.nombre))
        .count()
    )
    if en_uso:
        raise HTTPException(status_code=409, detail=f"El puerto está en uso por {en_uso} ítem(s)")
    db.delete(puerto)
    db.commit()
