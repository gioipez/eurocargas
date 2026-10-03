import os
import tempfile

# Debe fijarse antes de importar la app: database.py lee la variable al importarse.
_tmp = tempfile.mkdtemp(prefix="eurocargas-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import migrations  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    migrations.run(engine)
    return TestClient(app)


@pytest.fixture()
def empresa(client):
    return client.post("/api/empresas", json={"nombre": "Maersk", "tipo": "naviera"}).json()


@pytest.fixture()
def puertos(client):
    for nombre, codigo in (("Shanghai", "CNSHA"), ("Cartagena", "COCTG")):
        assert client.post("/api/puertos", json={"nombre": nombre, "codigo": codigo}).status_code == 201


def item_payload(empresa_id, **overrides):
    base = {
        "empresa_id": empresa_id,
        "tipo": "contenedor_maritimo",
        "descripcion": "Contenedor 40' estándar",
        "origen": "Shanghai",
        "destino": "Cartagena",
        "unidad_tarifa": "por_contenedor",
        "costo_base": 2800,
        "tipo_importacion": "importacion",
        "vigencia_dias": 30,
        "transito_dias": 32,
        "frecuencia": "semanal",
        "incoterm": "FOB",
    }
    base.update(overrides)
    return base
