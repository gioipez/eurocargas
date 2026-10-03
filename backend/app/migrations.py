"""Migración idempotente para SQLite (el proyecto no usa Alembic).

`Base.metadata.create_all` crea tablas nuevas pero no agrega columnas a tablas existentes,
así que las columnas añadidas después se aplican aquí con ALTER TABLE ... ADD COLUMN.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# tabla -> {columna: tipo SQL}. Todas nullable: los datos previos quedan en NULL ("sin dato").
COLUMNAS_NUEVAS = {
    "items": {
        "transito_dias": "INTEGER",
        "frecuencia": "VARCHAR(9)",
        "incoterm": "VARCHAR(3)",
    },
    "cotizacion_items": {
        "empresa_nombre": "VARCHAR",
        "descripcion": "VARCHAR",
        "origen": "VARCHAR",
        "destino": "VARCHAR",
        "transito_dias": "INTEGER",
        "frecuencia": "VARCHAR(9)",
        "incoterm": "VARCHAR(3)",
    },
}


def run(engine: Engine) -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for tabla, columnas in COLUMNAS_NUEVAS.items():
            existentes = {c["name"] for c in insp.get_columns(tabla)}
            for nombre, tipo in columnas.items():
                if nombre not in existentes:
                    conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {nombre} {tipo}"))
        _poblar_puertos_desde_items(conn)
        _rellenar_snapshot_cotizaciones(conn)


def _poblar_puertos_desde_items(conn) -> None:
    """Todo origen/destino ya usado por un ítem debe existir en el catálogo, para que los datos
    previos sigan siendo válidos bajo la nueva validación. Deduplica sin distinguir mayúsculas."""
    conocidos = {n.casefold() for (n,) in conn.execute(text("SELECT nombre FROM puertos"))}
    usados = conn.execute(
        text("SELECT origen FROM items UNION SELECT destino FROM items ORDER BY 1")
    )
    for (nombre,) in usados:
        limpio = nombre.strip()
        if limpio and limpio.casefold() not in conocidos:
            conn.execute(text("INSERT INTO puertos (nombre) VALUES (:n)"), {"n": limpio})
            conocidos.add(limpio.casefold())


def _rellenar_snapshot_cotizaciones(conn) -> None:
    """Cotizaciones previas al snapshot: se copia el estado actual del ítem (mejor dato disponible)."""
    conn.execute(text(
        """
        UPDATE cotizacion_items SET
            empresa_nombre = (SELECT e.nombre FROM items i JOIN empresas e ON e.id = i.empresa_id
                              WHERE i.id = cotizacion_items.item_id),
            descripcion = (SELECT i.descripcion FROM items i WHERE i.id = cotizacion_items.item_id),
            origen = (SELECT i.origen FROM items i WHERE i.id = cotizacion_items.item_id),
            destino = (SELECT i.destino FROM items i WHERE i.id = cotizacion_items.item_id),
            transito_dias = (SELECT i.transito_dias FROM items i WHERE i.id = cotizacion_items.item_id),
            frecuencia = (SELECT i.frecuencia FROM items i WHERE i.id = cotizacion_items.item_id),
            incoterm = (SELECT i.incoterm FROM items i WHERE i.id = cotizacion_items.item_id)
        WHERE descripcion IS NULL
        """
    ))
