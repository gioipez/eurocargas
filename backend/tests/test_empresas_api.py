from app import models
from app.database import SessionLocal

from .conftest import item_payload


def test_crea_y_lista_ordenado_por_nombre(client):
    for nombre in ("Zeta", "Alfa"):
        assert client.post("/api/empresas", json={"nombre": nombre, "tipo": "agente"}).status_code == 201
    assert [e["nombre"] for e in client.get("/api/empresas").json()] == ["Alfa", "Zeta"]


def test_tipo_invalido_es_422(client):
    assert client.post("/api/empresas", json={"nombre": "X", "tipo": "barco"}).status_code == 422


def test_eliminar_y_404_posterior(client, empresa):
    assert client.delete(f"/api/empresas/{empresa['id']}").status_code == 204
    assert client.delete(f"/api/empresas/{empresa['id']}").status_code == 404
    assert client.get("/api/empresas").json() == []


def test_eliminar_empresa_elimina_sus_items_y_recargos(client, empresa, puertos):
    client.post("/api/items", json=item_payload(empresa["id"], recargos=[{"concepto": "baf", "porcentaje": 0.04}]))
    assert client.delete(f"/api/empresas/{empresa['id']}").status_code == 204
    with SessionLocal() as db:
        assert db.query(models.Item).count() == 0
        assert db.query(models.ItemRecargo).count() == 0
