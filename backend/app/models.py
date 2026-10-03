import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class TipoEmpresa(str, enum.Enum):
    naviera = "naviera"
    aerolinea = "aerolinea"
    agente = "agente"


class TipoItem(str, enum.Enum):
    contenedor_maritimo = "contenedor_maritimo"
    carga_aerea = "carga_aerea"
    lcl = "lcl"


class UnidadTarifa(str, enum.Enum):
    por_contenedor = "por_contenedor"
    por_kg = "por_kg"
    por_cbm_wm = "por_cbm_wm"


class TipoImportacion(str, enum.Enum):
    importacion = "importacion"
    exportacion = "exportacion"


class Moneda(str, enum.Enum):
    USD = "USD"
    COP = "COP"


class Incoterm(str, enum.Enum):
    EXW = "EXW"
    FCA = "FCA"
    CPT = "CPT"
    CIP = "CIP"
    DAP = "DAP"
    DPU = "DPU"
    DDP = "DDP"
    FAS = "FAS"
    FOB = "FOB"
    CFR = "CFR"
    CIF = "CIF"


class FrecuenciaSalida(str, enum.Enum):
    diaria = "diaria"
    semanal = "semanal"
    quincenal = "quincenal"
    mensual = "mensual"


class ConceptoRecargo(str, enum.Enum):
    baf = "baf"
    caf = "caf"
    thc = "thc"
    documentacion = "documentacion"
    combustible = "combustible"
    seguridad = "seguridad"
    otros = "otros"


class TipoMargen(str, enum.Enum):
    monto_fijo_total = "monto_fijo_total"
    monto_fijo_item = "monto_fijo_item"
    porcentaje_total = "porcentaje_total"
    porcentaje_item = "porcentaje_item"


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    tipo = Column(Enum(TipoEmpresa), nullable=False)

    items = relationship("Item", back_populates="empresa", cascade="all, delete-orphan")


class Puerto(Base):
    """Catálogo de puertos/aeropuertos. `Item.origen`/`Item.destino` guardan el `nombre` canónico."""

    __tablename__ = "puertos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, unique=True)
    codigo = Column(String, unique=True)  # UN/LOCODE (5) o IATA (3); NULL en datos migrados
    pais = Column(String)


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    tipo = Column(Enum(TipoItem), nullable=False)
    descripcion = Column(String, nullable=False)
    origen = Column(String, nullable=False, index=True)
    destino = Column(String, nullable=False, index=True)
    unidad_tarifa = Column(Enum(UnidadTarifa), nullable=False)
    costo_base = Column(Float, nullable=False)
    impuestos_pct = Column(Float, nullable=False, default=0.0)
    tipo_importacion = Column(Enum(TipoImportacion), nullable=False)
    vigencia_dias = Column(Integer, nullable=False)
    fecha_creacion = Column(DateTime, nullable=False, default=utcnow)
    # NULL en ítems anteriores a estos campos ("sin dato"); la API los exige en ítems nuevos.
    transito_dias = Column(Integer)
    frecuencia = Column(Enum(FrecuenciaSalida))
    incoterm = Column(Enum(Incoterm))

    empresa = relationship("Empresa", back_populates="items")
    recargos = relationship(
        "ItemRecargo", back_populates="item", cascade="all, delete-orphan", order_by="ItemRecargo.id"
    )


class ItemRecargo(Base):
    """Desglose opcional de `Item.impuestos_pct`. Si existe, `impuestos_pct` es la suma de sus porcentajes."""

    __tablename__ = "item_recargos"
    __table_args__ = (UniqueConstraint("item_id", "concepto"),)

    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    concepto = Column(Enum(ConceptoRecargo), nullable=False)
    porcentaje = Column(Float, nullable=False)

    item = relationship("Item", back_populates="recargos")


class Configuracion(Base):
    __tablename__ = "configuracion"

    id = Column(Integer, primary_key=True, default=1)
    tasa_cambio_usd_cop = Column(Float, nullable=False, default=4000.0)


class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    id = Column(Integer, primary_key=True, index=True)
    consecutivo = Column(String, unique=True, nullable=False, index=True)
    fecha = Column(DateTime, nullable=False, default=utcnow)
    cliente_nombre = Column(String, nullable=False)
    moneda = Column(Enum(Moneda), nullable=False, default=Moneda.USD)
    tasa_cambio = Column(Float, nullable=False)
    tipo_margen = Column(Enum(TipoMargen), nullable=False)
    valor_margen = Column(Float, nullable=False)
    vigencia_hasta = Column(DateTime, nullable=False)

    items = relationship("CotizacionItem", back_populates="cotizacion", cascade="all, delete-orphan")


class CotizacionItem(Base):
    __tablename__ = "cotizacion_items"

    id = Column(Integer, primary_key=True, index=True)
    cotizacion_id = Column(Integer, ForeignKey("cotizaciones.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    cantidad = Column(Float, nullable=False, default=1.0)
    costo_original = Column(Float, nullable=False)
    margen_aplicado = Column(Float, nullable=False)
    precio_final = Column(Float, nullable=False)
    # Copia de lo que muestra el PDF: el ítem es editable, la cotización emitida no debe cambiar.
    # NULL solo en cotizaciones anteriores a estas columnas (la migración las rellena).
    empresa_nombre = Column(String)
    descripcion = Column(String)
    origen = Column(String)
    destino = Column(String)
    transito_dias = Column(Integer)
    frecuencia = Column(Enum(FrecuenciaSalida))
    incoterm = Column(Enum(Incoterm))

    cotizacion = relationship("Cotizacion", back_populates="items")
    item = relationship("Item")
