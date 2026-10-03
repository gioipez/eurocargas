from datetime import datetime, timedelta, timezone

from . import migrations
from .database import Base, SessionLocal, engine
from .models import (
    ConceptoRecargo,
    Configuracion,
    Empresa,
    FrecuenciaSalida,
    Incoterm,
    Item,
    ItemRecargo,
    Puerto,
    TipoEmpresa,
    TipoImportacion,
    TipoItem,
    UnidadTarifa,
)


def dias_atras(n: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=n)


def run():
    Base.metadata.create_all(bind=engine)
    migrations.run(engine)
    db = SessionLocal()
    try:
        if db.query(Empresa).count() > 0:
            print("Ya existen datos, se omite el seed.")
            return

        if not db.get(Configuracion, 1):
            db.add(Configuracion(id=1, tasa_cambio_usd_cop=4000.0))

        maersk = Empresa(nombre="Maersk Line", tipo=TipoEmpresa.naviera)
        hapag = Empresa(nombre="Hapag-Lloyd", tipo=TipoEmpresa.naviera)
        avianca = Empresa(nombre="Avianca Cargo", tipo=TipoEmpresa.aerolinea)
        dhl = Empresa(nombre="DHL Global Forwarding", tipo=TipoEmpresa.aerolinea)
        agencia = Empresa(nombre="Agencia Global Cargo", tipo=TipoEmpresa.agente)
        db.add_all([maersk, hapag, avianca, dhl, agencia])
        db.flush()

        db.add_all([
            Puerto(nombre="Shanghai", codigo="CNSHA", pais="China"),
            Puerto(nombre="Cartagena", codigo="COCTG", pais="Colombia"),
            Puerto(nombre="Rotterdam", codigo="NLRTM", pais="Países Bajos"),
            Puerto(nombre="Miami", codigo="MIA", pais="Estados Unidos"),
            Puerto(nombre="Bogota", codigo="BOG", pais="Colombia"),
        ])

        def rec(**porcentajes: float) -> list[ItemRecargo]:
            return [ItemRecargo(concepto=ConceptoRecargo[c], porcentaje=p) for c, p in porcentajes.items()]

        # impuestos_pct = suma de los recargos desglosados (misma regla que aplica la API).
        items = [
            # Shanghai -> Cartagena, contenedor 40', importación
            Item(empresa_id=maersk.id, tipo=TipoItem.contenedor_maritimo, descripcion="Contenedor 40' estándar",
                 origen="Shanghai", destino="Cartagena", unidad_tarifa=UnidadTarifa.por_contenedor,
                 costo_base=2800, impuestos_pct=0.08, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=30, fecha_creacion=dias_atras(5),
                 transito_dias=32, frecuencia=FrecuenciaSalida.semanal, incoterm=Incoterm.FOB,
                 recargos=rec(baf=0.04, thc=0.03, documentacion=0.01)),
            Item(empresa_id=hapag.id, tipo=TipoItem.contenedor_maritimo, descripcion="Contenedor 40' estándar",
                 origen="Shanghai", destino="Cartagena", unidad_tarifa=UnidadTarifa.por_contenedor,
                 costo_base=2950, impuestos_pct=0.07, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=45, fecha_creacion=dias_atras(2),
                 transito_dias=28, frecuencia=FrecuenciaSalida.semanal, incoterm=Incoterm.FOB,
                 recargos=rec(baf=0.03, caf=0.01, thc=0.03)),
            Item(empresa_id=agencia.id, tipo=TipoItem.contenedor_maritimo, descripcion="Contenedor 40' consolidado",
                 origen="Shanghai", destino="Cartagena", unidad_tarifa=UnidadTarifa.por_contenedor,
                 costo_base=3100, impuestos_pct=0.05, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=15, fecha_creacion=dias_atras(10),
                 transito_dias=38, frecuencia=FrecuenciaSalida.quincenal, incoterm=Incoterm.CIF,
                 recargos=rec(thc=0.03, documentacion=0.02)),

            # Shanghai -> Cartagena, contenedor 20', importación
            Item(empresa_id=maersk.id, tipo=TipoItem.contenedor_maritimo, descripcion="Contenedor 20' estándar",
                 origen="Shanghai", destino="Cartagena", unidad_tarifa=UnidadTarifa.por_contenedor,
                 costo_base=1800, impuestos_pct=0.08, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=30, fecha_creacion=dias_atras(5),
                 transito_dias=32, frecuencia=FrecuenciaSalida.semanal, incoterm=Incoterm.FOB,
                 recargos=rec(baf=0.04, thc=0.03, documentacion=0.01)),
            Item(empresa_id=hapag.id, tipo=TipoItem.contenedor_maritimo, descripcion="Contenedor 20' estándar",
                 origen="Shanghai", destino="Cartagena", unidad_tarifa=UnidadTarifa.por_contenedor,
                 costo_base=1900, impuestos_pct=0.07, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=45, fecha_creacion=dias_atras(2),
                 transito_dias=28, frecuencia=FrecuenciaSalida.semanal, incoterm=Incoterm.FOB,
                 recargos=rec(baf=0.03, caf=0.01, thc=0.03)),

            # Shanghai -> Cartagena, LCL, importación (tarifa por CBM / W/M)
            Item(empresa_id=agencia.id, tipo=TipoItem.lcl, descripcion="LCL consolidado marítimo",
                 origen="Shanghai", destino="Cartagena", unidad_tarifa=UnidadTarifa.por_cbm_wm,
                 costo_base=95, impuestos_pct=0.04, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=25, fecha_creacion=dias_atras(8),
                 transito_dias=42, frecuencia=FrecuenciaSalida.semanal, incoterm=Incoterm.FOB,
                 recargos=rec(thc=0.03, documentacion=0.01)),
            Item(empresa_id=dhl.id, tipo=TipoItem.lcl, descripcion="LCL consolidado marítimo",
                 origen="Shanghai", destino="Cartagena", unidad_tarifa=UnidadTarifa.por_cbm_wm,
                 costo_base=110, impuestos_pct=0.03, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=40, fecha_creacion=dias_atras(1),
                 transito_dias=35, frecuencia=FrecuenciaSalida.diaria, incoterm=Incoterm.EXW,
                 recargos=rec(thc=0.02, documentacion=0.01)),

            # Miami -> Bogota, carga aérea, importación (tarifa por kg)
            Item(empresa_id=avianca.id, tipo=TipoItem.carga_aerea, descripcion="Carga aérea general",
                 origen="Miami", destino="Bogota", unidad_tarifa=UnidadTarifa.por_kg,
                 costo_base=4.50, impuestos_pct=0.06, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=20, fecha_creacion=dias_atras(3),
                 transito_dias=3, frecuencia=FrecuenciaSalida.diaria, incoterm=Incoterm.FCA,
                 recargos=rec(combustible=0.04, seguridad=0.02)),
            Item(empresa_id=dhl.id, tipo=TipoItem.carga_aerea, descripcion="Carga aérea express",
                 origen="Miami", destino="Bogota", unidad_tarifa=UnidadTarifa.por_kg,
                 costo_base=5.20, impuestos_pct=0.05, tipo_importacion=TipoImportacion.importacion,
                 vigencia_dias=30, fecha_creacion=dias_atras(6),
                 transito_dias=1, frecuencia=FrecuenciaSalida.diaria, incoterm=Incoterm.DAP,
                 recargos=rec(combustible=0.03, seguridad=0.02)),

            # Cartagena -> Rotterdam, contenedor 40', exportación
            Item(empresa_id=maersk.id, tipo=TipoItem.contenedor_maritimo, descripcion="Contenedor 40' estándar",
                 origen="Cartagena", destino="Rotterdam", unidad_tarifa=UnidadTarifa.por_contenedor,
                 costo_base=3200, impuestos_pct=0.08, tipo_importacion=TipoImportacion.exportacion,
                 vigencia_dias=30, fecha_creacion=dias_atras(4),
                 transito_dias=18, frecuencia=FrecuenciaSalida.semanal, incoterm=Incoterm.FOB,
                 recargos=rec(baf=0.04, thc=0.03, documentacion=0.01)),
            Item(empresa_id=hapag.id, tipo=TipoItem.contenedor_maritimo, descripcion="Contenedor 40' estándar",
                 origen="Cartagena", destino="Rotterdam", unidad_tarifa=UnidadTarifa.por_contenedor,
                 costo_base=3350, impuestos_pct=0.07, tipo_importacion=TipoImportacion.exportacion,
                 vigencia_dias=20, fecha_creacion=dias_atras(12),
                 transito_dias=21, frecuencia=FrecuenciaSalida.quincenal, incoterm=Incoterm.CIF,
                 recargos=rec(baf=0.03, caf=0.01, thc=0.03)),
        ]
        db.add_all(items)
        db.commit()
        print(f"Seed completado: 5 empresas, {len(items)} items.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
