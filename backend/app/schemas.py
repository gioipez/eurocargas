from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import (
    ConceptoRecargo,
    FrecuenciaSalida,
    Incoterm,
    Moneda,
    TipoEmpresa,
    TipoImportacion,
    TipoItem,
    TipoMargen,
    UnidadTarifa,
)


class EmpresaBase(BaseModel):
    nombre: str
    tipo: TipoEmpresa


class EmpresaCreate(EmpresaBase):
    pass


class EmpresaOut(EmpresaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class PuertoCreate(BaseModel):
    nombre: str = Field(min_length=1)
    # UN/LOCODE (5 caracteres, p. ej. COCTG) o IATA (3, p. ej. BOG).
    codigo: str | None = Field(default=None, pattern=r"^([A-Z]{3}|[A-Z]{2}[A-Z0-9]{3})$")
    pais: str | None = None

    @field_validator("nombre")
    @classmethod
    def _nombre_sin_espacios(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío")
        return v


class PuertoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    codigo: str | None
    pais: str | None


class RecargoIn(BaseModel):
    concepto: ConceptoRecargo
    # Fracción sobre el costo base (0.03 = 3%), igual que `impuestos_pct`.
    porcentaje: float = Field(ge=0)


class RecargoOut(RecargoIn):
    model_config = ConfigDict(from_attributes=True)


class ItemBase(BaseModel):
    empresa_id: int
    tipo: TipoItem
    descripcion: str
    origen: str
    destino: str
    unidad_tarifa: UnidadTarifa
    costo_base: float = Field(gt=0)
    impuestos_pct: float = Field(ge=0, default=0.0)
    tipo_importacion: TipoImportacion
    vigencia_dias: int = Field(gt=0)


class ItemCreate(ItemBase):
    transito_dias: int = Field(gt=0)
    frecuencia: FrecuenciaSalida
    incoterm: Incoterm
    # Si se envía, `impuestos_pct` se calcula como la suma; no se puede contradecir.
    recargos: list[RecargoIn] = []

    @field_validator("recargos")
    @classmethod
    def _sin_conceptos_repetidos(cls, v: list[RecargoIn]) -> list[RecargoIn]:
        conceptos = [r.concepto for r in v]
        if len(conceptos) != len(set(conceptos)):
            raise ValueError("Hay conceptos de recargo repetidos")
        return v


class ItemOut(ItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fecha_creacion: datetime
    empresa: EmpresaOut
    # None en ítems anteriores a estos campos.
    transito_dias: int | None
    frecuencia: FrecuenciaSalida | None
    incoterm: Incoterm | None
    recargos: list[RecargoOut]


class ConfiguracionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    tasa_cambio_usd_cop: float


class ConfiguracionUpdate(BaseModel):
    tasa_cambio_usd_cop: float = Field(gt=0)


class CotizacionCreate(BaseModel):
    item_id: int
    cantidad: float = Field(gt=0, default=1.0)
    cliente_nombre: str
    moneda: Moneda = Moneda.USD
    tasa_cambio: float | None = Field(default=None, gt=0)
    tipo_margen: TipoMargen
    valor_margen: float = Field(ge=0)


class CotizacionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_id: int
    cantidad: float
    costo_original: float
    margen_aplicado: float
    precio_final: float
    empresa_nombre: str | None
    descripcion: str | None
    origen: str | None
    destino: str | None
    transito_dias: int | None
    frecuencia: FrecuenciaSalida | None
    incoterm: Incoterm | None
    item: ItemOut


class CotizacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    consecutivo: str
    fecha: datetime
    cliente_nombre: str
    moneda: Moneda
    tasa_cambio: float
    tipo_margen: TipoMargen
    valor_margen: float
    vigencia_hasta: datetime
    items: list[CotizacionItemOut]
