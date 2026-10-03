from app import models, schemas, seed
from app.database import SessionLocal


def test_el_seed_es_consistente_e_idempotente(client):
    seed.run()
    seed.run()  # idempotente: no duplica

    items = client.get("/api/items").json()
    assert len(items) == 11
    assert len(client.get("/api/empresas").json()) == 5
    catalogo = {p["nombre"] for p in client.get("/api/puertos").json()}

    for it in items:
        assert it["origen"] in catalogo and it["destino"] in catalogo
        assert it["transito_dias"] and it["frecuencia"] and it["incoterm"], it["id"]
        assert it["recargos"], it["id"]
        assert abs(sum(r["porcentaje"] for r in it["recargos"]) - it["impuestos_pct"]) < 1e-9, it["id"]
        # Cada ítem sembrado debe ser aceptado tal cual por el contrato de la API.
        schemas.ItemCreate(**{**it, "empresa_id": it["empresa"]["id"]})

    with SessionLocal() as db:
        assert db.get(models.Configuracion, 1).tasa_cambio_usd_cop == 4000.0
        assert db.query(models.Cotizacion).count() == 0


def test_el_seed_incluye_un_caso_de_incoterms_distintos(client):
    seed.run()
    fcl40 = [i for i in client.get("/api/items").json()
             if i["origen"] == "Shanghai" and i["destino"] == "Cartagena" and "40'" in i["descripcion"]]
    assert len({i["incoterm"] for i in fcl40}) > 1  # alimenta la alerta de comparación
