from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..pdf.generator import render_cotizacion_pdf
from .config import _get_or_create as get_config

router = APIRouter(prefix="/api/cotizaciones", tags=["cotizaciones"])


def _siguiente_consecutivo(db: Session) -> str:
    anio = datetime.now(timezone.utc).year
    prefijo = f"COT-{anio}-"
    existentes = (
        db.query(models.Cotizacion)
        .filter(models.Cotizacion.consecutivo.like(f"{prefijo}%"))
        .count()
    )
    return f"{prefijo}{existentes + 1:04d}"


def _calcular_costos(item: models.Item, cantidad: float, tipo_margen, valor_margen: float):
    cantidad_efectiva = 1.0 if item.unidad_tarifa == models.UnidadTarifa.por_contenedor else cantidad
    costo_base_total = item.costo_base * cantidad_efectiva
    impuestos_monto = costo_base_total * item.impuestos_pct
    costo_original = costo_base_total + impuestos_monto

    if tipo_margen in (models.TipoMargen.monto_fijo_total, models.TipoMargen.monto_fijo_item):
        margen_aplicado = valor_margen
    else:
        margen_aplicado = costo_original * (valor_margen / 100.0)

    precio_final = costo_original + margen_aplicado
    return cantidad_efectiva, costo_original, margen_aplicado, precio_final


@router.post("", response_model=schemas.CotizacionOut, status_code=201)
def crear_cotizacion(payload: schemas.CotizacionCreate, db: Session = Depends(get_db)):
    item = db.get(models.Item, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    tasa_cambio = payload.tasa_cambio
    if tasa_cambio is None:
        tasa_cambio = get_config(db).tasa_cambio_usd_cop

    cantidad_efectiva, costo_original, margen_aplicado, precio_final = _calcular_costos(
        item, payload.cantidad, payload.tipo_margen, payload.valor_margen
    )

    vigencia_hasta = item.fecha_creacion + timedelta(days=item.vigencia_dias)

    cotizacion = models.Cotizacion(
        consecutivo=_siguiente_consecutivo(db),
        cliente_nombre=payload.cliente_nombre,
        moneda=payload.moneda,
        tasa_cambio=tasa_cambio,
        tipo_margen=payload.tipo_margen,
        valor_margen=payload.valor_margen,
        vigencia_hasta=vigencia_hasta,
    )
    cotizacion.items.append(
        models.CotizacionItem(
            item_id=item.id,
            cantidad=cantidad_efectiva,
            costo_original=costo_original,
            margen_aplicado=margen_aplicado,
            precio_final=precio_final,
            empresa_nombre=item.empresa.nombre,
            descripcion=item.descripcion,
            origen=item.origen,
            destino=item.destino,
            transito_dias=item.transito_dias,
            frecuencia=item.frecuencia,
            incoterm=item.incoterm,
        )
    )
    db.add(cotizacion)
    db.commit()
    db.refresh(cotizacion)
    return _con_relaciones(db, cotizacion.id)


def _con_relaciones(db: Session, cotizacion_id: int) -> models.Cotizacion:
    return (
        db.query(models.Cotizacion)
        .options(
            joinedload(models.Cotizacion.items).joinedload(models.CotizacionItem.item).joinedload(models.Item.empresa)
        )
        .filter(models.Cotizacion.id == cotizacion_id)
        .one()
    )


@router.get("/{cotizacion_id}", response_model=schemas.CotizacionOut)
def obtener_cotizacion(cotizacion_id: int, db: Session = Depends(get_db)):
    cotizacion = db.get(models.Cotizacion, cotizacion_id)
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return _con_relaciones(db, cotizacion_id)


@router.get("/{cotizacion_id}/pdf")
def descargar_pdf(cotizacion_id: int, db: Session = Depends(get_db)):
    cotizacion = db.get(models.Cotizacion, cotizacion_id)
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    cotizacion = _con_relaciones(db, cotizacion_id)
    pdf_bytes = render_cotizacion_pdf(cotizacion)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{cotizacion.consecutivo}.pdf"'},
    )
