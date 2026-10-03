from sqlalchemy import create_engine, inspect, text

from app import migrations
from app.database import Base

# Esquema de `items` previo a transito_dias/frecuencia/incoterm.
LEGACY_ITEMS = """
CREATE TABLE items (
    id INTEGER PRIMARY KEY, empresa_id INTEGER NOT NULL, tipo VARCHAR(19) NOT NULL,
    descripcion VARCHAR NOT NULL, origen VARCHAR NOT NULL, destino VARCHAR NOT NULL,
    unidad_tarifa VARCHAR(14) NOT NULL, costo_base FLOAT NOT NULL, impuestos_pct FLOAT NOT NULL,
    tipo_importacion VARCHAR(11) NOT NULL, vigencia_dias INTEGER NOT NULL, fecha_creacion DATETIME NOT NULL
)
"""


LEGACY_COT_ITEMS = """
CREATE TABLE cotizacion_items (
    id INTEGER PRIMARY KEY, cotizacion_id INTEGER NOT NULL, item_id INTEGER NOT NULL, cantidad FLOAT NOT NULL,
    costo_original FLOAT NOT NULL, margen_aplicado FLOAT NOT NULL, precio_final FLOAT NOT NULL
)
"""


def _legacy_engine(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path}/legacy.db")
    with eng.begin() as conn:
        conn.execute(text(LEGACY_ITEMS))
        conn.execute(text(LEGACY_COT_ITEMS))
        conn.execute(text("CREATE TABLE empresas (id INTEGER PRIMARY KEY, nombre VARCHAR NOT NULL, tipo VARCHAR(9) NOT NULL)"))
        conn.execute(text("INSERT INTO empresas VALUES (1,'Maersk','naviera')"))
        conn.execute(text("INSERT INTO cotizacion_items VALUES (1,1,1,1,100,10,110)"))
        conn.execute(text(
            "INSERT INTO items VALUES "
            "(1,1,'lcl','LCL','Shanghai','Cartagena','por_cbm_wm',95,0.04,'importacion',25,'2026-01-01'),"
            "(2,1,'lcl','LCL','shanghai ','Rotterdam','por_cbm_wm',99,0.04,'importacion',25,'2026-01-01')"
        ))
    # Igual que main.py: create_all crea tablas nuevas y deja intactas las existentes.
    Base.metadata.create_all(bind=eng)
    return eng


def test_agrega_columnas_conserva_datos_y_pobla_puertos(tmp_path):
    eng = _legacy_engine(tmp_path)
    migrations.run(eng)

    columnas = {c["name"] for c in inspect(eng).get_columns("items")}
    assert {"transito_dias", "frecuencia", "incoterm"} <= columnas

    with eng.connect() as conn:
        fila = conn.execute(text("SELECT costo_base, transito_dias, incoterm FROM items WHERE id=1")).one()
        assert tuple(fila) == (95, None, None)  # dato previo intacto, sin valores inventados
        nombres = [n for (n,) in conn.execute(text("SELECT nombre FROM puertos ORDER BY nombre"))]
    # "shanghai " se deduplica contra "Shanghai" sin distinguir mayúsculas ni espacios.
    assert nombres == ["Cartagena", "Rotterdam", "Shanghai"]


def test_es_idempotente(tmp_path):
    eng = _legacy_engine(tmp_path)
    migrations.run(eng)
    migrations.run(eng)
    with eng.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM puertos")).scalar() == 3


def test_cotizaciones_previas_reciben_snapshot_del_item(tmp_path):
    eng = _legacy_engine(tmp_path)
    migrations.run(eng)
    with eng.connect() as conn:
        fila = conn.execute(text(
            "SELECT empresa_nombre, descripcion, origen, destino, precio_final FROM cotizacion_items"
        )).one()
    assert tuple(fila) == ("Maersk", "LCL", "Shanghai", "Cartagena", 110)


def test_backfill_no_pisa_un_snapshot_existente(tmp_path):
    eng = _legacy_engine(tmp_path)
    migrations.run(eng)
    with eng.begin() as conn:
        conn.execute(text("UPDATE items SET descripcion='Cambiada' WHERE id=1"))
    migrations.run(eng)
    with eng.connect() as conn:
        assert conn.execute(text("SELECT descripcion FROM cotizacion_items")).scalar() == "LCL"
