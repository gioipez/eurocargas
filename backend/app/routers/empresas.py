from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/empresas", tags=["empresas"])


@router.get("", response_model=list[schemas.EmpresaOut])
def listar_empresas(db: Session = Depends(get_db)):
    return db.query(models.Empresa).order_by(models.Empresa.nombre).all()


@router.post("", response_model=schemas.EmpresaOut, status_code=201)
def crear_empresa(payload: schemas.EmpresaCreate, db: Session = Depends(get_db)):
    empresa = models.Empresa(**payload.model_dump())
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return empresa


@router.delete("/{empresa_id}", status_code=204)
def eliminar_empresa(empresa_id: int, db: Session = Depends(get_db)):
    empresa = db.get(models.Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    db.delete(empresa)
    db.commit()
