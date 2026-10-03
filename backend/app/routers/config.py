from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/config", tags=["config"])


def _get_or_create(db: Session) -> models.Configuracion:
    config = db.get(models.Configuracion, 1)
    if not config:
        config = models.Configuracion(id=1, tasa_cambio_usd_cop=4000.0)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("", response_model=schemas.ConfiguracionOut)
def obtener_config(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("", response_model=schemas.ConfiguracionOut)
def actualizar_config(payload: schemas.ConfiguracionUpdate, db: Session = Depends(get_db)):
    config = _get_or_create(db)
    config.tasa_cambio_usd_cop = payload.tasa_cambio_usd_cop
    db.commit()
    db.refresh(config)
    return config
