from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/items", tags=["items"])


def _puerto_canonico(db: Session, nombre: str, campo: str) -> str:
    """Devuelve el nombre del catálogo (sin distinguir mayúsculas) o 422 si no existe."""
    puerto = (
        db.query(models.Puerto)
        .filter(func.lower(models.Puerto.nombre) == nombre.strip().lower())
        .first()
    )
    if not puerto:
        raise HTTPException(
            status_code=422,
            detail=f"El {campo} '{nombre}' no está en el catálogo de puertos/aeropuertos",
        )
    return puerto.nombre


@router.get("", response_model=list[schemas.ItemOut])
def listar_items(db: Session = Depends(get_db)):
    return (
        db.query(models.Item)
        .options(joinedload(models.Item.empresa), selectinload(models.Item.recargos))
        .order_by(models.Item.origen, models.Item.destino)
        .all()
    )


def _preparar(db: Session, payload: schemas.ItemCreate):
    """Valida y normaliza el payload de crear/actualizar. Devuelve (columnas, recargos)."""
    if not db.get(models.Empresa, payload.empresa_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    datos = payload.model_dump(exclude={"recargos"})
    datos["origen"] = _puerto_canonico(db, payload.origen, "origen")
    datos["destino"] = _puerto_canonico(db, payload.destino, "destino")

    if payload.recargos:
        total = sum(r.porcentaje for r in payload.recargos)
        if payload.impuestos_pct and abs(payload.impuestos_pct - total) > 1e-9:
            raise HTTPException(
                status_code=422,
                detail="impuestos_pct no coincide con la suma de los recargos desglosados",
            )
        datos["impuestos_pct"] = total

    recargos = [models.ItemRecargo(concepto=r.concepto, porcentaje=r.porcentaje) for r in payload.recargos]
    return datos, recargos


@router.post("", response_model=schemas.ItemOut, status_code=201)
def crear_item(payload: schemas.ItemCreate, db: Session = Depends(get_db)):
    datos, recargos = _preparar(db, payload)
    item = models.Item(**datos, recargos=recargos)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=schemas.ItemOut)
def actualizar_item(item_id: int, payload: schemas.ItemCreate, db: Session = Depends(get_db)):
    """Reemplazo completo. `fecha_creacion` no cambia: la vigencia se ajusta con `vigencia_dias`.
    Las cotizaciones ya emitidas no cambian (guardan su propio snapshot)."""
    item = db.get(models.Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    datos, recargos = _preparar(db, payload)
    for campo, valor in datos.items():
        setattr(item, campo, valor)
    # flush intermedio: el UnitOfWork inserta antes de borrar y chocaría con UNIQUE(item_id, concepto).
    item.recargos.clear()
    db.flush()
    item.recargos = recargos
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def eliminar_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    db.delete(item)
    db.commit()
