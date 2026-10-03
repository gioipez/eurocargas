from datetime import datetime, timezone

from app import models
from app.database import SessionLocal

from .conftest import item_payload


def test_crea_item_con_recargos_y_suma_impuestos(client, empresa, puertos):
    r = client.post("/api/items", json=item_payload(
        empresa["id"],
        recargos=[{"concepto": "baf", "porcentaje": 0.04}, {"concepto": "thc", "porcentaje": 0.03}],
    ))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["impuestos_pct"] == 0.07
    assert body["incoterm"] == "FOB" and body["transito_dias"] == 32 and body["frecuencia"] == "semanal"
    assert {x["concepto"] for x in body["recargos"]} == {"baf", "thc"}


def test_sin_recargos_conserva_impuestos_consolidado(client, empresa, puertos):
    r = client.post("/api/items", json=item_payload(empresa["id"], impuestos_pct=0.08))
    assert r.status_code == 201
    assert r.json()["impuestos_pct"] == 0.08 and r.json()["recargos"] == []


def test_impuestos_contradictorio_con_recargos_es_422(client, empresa, puertos):
    r = client.post("/api/items", json=item_payload(
        empresa["id"], impuestos_pct=0.20, recargos=[{"concepto": "baf", "porcentaje": 0.04}]
    ))
    assert r.status_code == 422


def test_impuestos_coincidente_con_recargos_es_aceptado(client, empresa, puertos):
    r = client.post("/api/items", json=item_payload(
        empresa["id"], impuestos_pct=0.04, recargos=[{"concepto": "baf", "porcentaje": 0.04}]
    ))
    assert r.status_code == 201


def test_concepto_de_recargo_repetido_es_422(client, empresa, puertos):
    r = client.post("/api/items", json=item_payload(
        empresa["id"], recargos=[{"concepto": "baf", "porcentaje": 0.01}, {"concepto": "baf", "porcentaje": 0.02}]
    ))
    assert r.status_code == 422


def test_puerto_fuera_del_catalogo_es_422(client, empresa, puertos):
    r = client.post("/api/items", json=item_payload(empresa["id"], origen="Atlantida"))
    assert r.status_code == 422
    assert "catálogo" in r.json()["detail"]


def test_puerto_se_normaliza_al_nombre_canonico(client, empresa, puertos):
    r = client.post("/api/items", json=item_payload(empresa["id"], origen=" shanghai ", destino="CARTAGENA"))
    assert r.status_code == 201
    assert (r.json()["origen"], r.json()["destino"]) == ("Shanghai", "Cartagena")


def test_campos_nuevos_son_obligatorios(client, empresa, puertos):
    for campo in ("transito_dias", "frecuencia", "incoterm"):
        payload = item_payload(empresa["id"])
        del payload[campo]
        assert client.post("/api/items", json=payload).status_code == 422, campo


def test_valores_invalidos_son_422(client, empresa, puertos):
    for overrides in ({"transito_dias": 0}, {"incoterm": "XYZ"}, {"frecuencia": "cada_tanto"}):
        r = client.post("/api/items", json=item_payload(empresa["id"], **overrides))
        assert r.status_code == 422, overrides


def test_item_legacy_sin_datos_nuevos_se_lista_con_nulls(client, empresa, puertos):
    with SessionLocal() as db:
        db.add(models.Item(
            empresa_id=empresa["id"], tipo=models.TipoItem.lcl, descripcion="Legacy", origen="Shanghai",
            destino="Cartagena", unidad_tarifa=models.UnidadTarifa.por_cbm_wm, costo_base=95,
            impuestos_pct=0.04, tipo_importacion=models.TipoImportacion.importacion, vigencia_dias=25,
            fecha_creacion=datetime.now(timezone.utc),
        ))
        db.commit()
    r = client.get("/api/items")
    assert r.status_code == 200
    legacy = r.json()[0]
    assert legacy["transito_dias"] is None and legacy["incoterm"] is None and legacy["recargos"] == []


def test_eliminar_item_elimina_sus_recargos(client, empresa, puertos):
    item = client.post("/api/items", json=item_payload(
        empresa["id"], recargos=[{"concepto": "baf", "porcentaje": 0.04}]
    )).json()
    assert client.delete(f"/api/items/{item['id']}").status_code == 204
    with SessionLocal() as db:
        assert db.query(models.ItemRecargo).count() == 0


def test_cotizacion_usa_el_total_de_recargos_y_el_pdf_muestra_condiciones(client, empresa, puertos):
    item = client.post("/api/items", json=item_payload(
        empresa["id"], recargos=[{"concepto": "baf", "porcentaje": 0.04}, {"concepto": "thc", "porcentaje": 0.03}]
    )).json()
    cot = client.post("/api/cotizaciones", json={
        "item_id": item["id"], "cliente_nombre": "ACME", "tipo_margen": "porcentaje_total", "valor_margen": 10,
    })
    assert cot.status_code == 201, cot.text
    # 2800 * 1.07 = 2996 de costo; +10% de margen
    assert abs(cot.json()["items"][0]["costo_original"] - 2996.0) < 1e-6
    assert abs(cot.json()["items"][0]["precio_final"] - 3295.6) < 1e-6

    pdf = client.get(f"/api/cotizaciones/{cot.json()['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def _crear(client, empresa, **overrides):
    r = client.post("/api/items", json=item_payload(empresa["id"], **overrides))
    assert r.status_code == 201, r.text
    return r.json()


def test_actualiza_item_y_conserva_id_y_fecha_creacion(client, empresa, puertos):
    item = _crear(client, empresa)
    r = client.put(f"/api/items/{item['id']}", json=item_payload(
        empresa["id"], costo_base=3000, transito_dias=25, incoterm="CIF", frecuencia="quincenal",
        descripcion="Nueva descripción", vigencia_dias=60,
    ))
    assert r.status_code == 200, r.text
    nuevo = r.json()
    assert nuevo["id"] == item["id"] and nuevo["fecha_creacion"] == item["fecha_creacion"]
    assert (nuevo["costo_base"], nuevo["transito_dias"], nuevo["incoterm"], nuevo["frecuencia"]) == (3000, 25, "CIF", "quincenal")
    assert client.get("/api/items").json()[0]["descripcion"] == "Nueva descripción"


def test_actualizar_reemplaza_recargos_incluso_repitiendo_concepto(client, empresa, puertos):
    # Regresión: reemplazar con el mismo concepto chocaba con UNIQUE(item_id, concepto).
    item = _crear(client, empresa, recargos=[{"concepto": "baf", "porcentaje": 0.04}, {"concepto": "thc", "porcentaje": 0.03}])
    r = client.put(f"/api/items/{item['id']}", json=item_payload(
        empresa["id"], recargos=[{"concepto": "baf", "porcentaje": 0.05}, {"concepto": "caf", "porcentaje": 0.01}]
    ))
    assert r.status_code == 200, r.text
    assert {x["concepto"]: x["porcentaje"] for x in r.json()["recargos"]} == {"baf": 0.05, "caf": 0.01}
    assert abs(r.json()["impuestos_pct"] - 0.06) < 1e-9
    with SessionLocal() as db:
        assert db.query(models.ItemRecargo).count() == 2


def test_actualizar_quitando_desglose_vuelve_al_consolidado(client, empresa, puertos):
    item = _crear(client, empresa, recargos=[{"concepto": "baf", "porcentaje": 0.04}])
    r = client.put(f"/api/items/{item['id']}", json=item_payload(empresa["id"], impuestos_pct=0.09))
    assert r.status_code == 200
    assert r.json()["recargos"] == [] and r.json()["impuestos_pct"] == 0.09


def test_actualizar_aplica_las_mismas_validaciones_que_crear(client, empresa, puertos):
    item = _crear(client, empresa)
    url = f"/api/items/{item['id']}"
    assert client.put(url, json=item_payload(empresa["id"], origen="Atlantida")).status_code == 422
    assert client.put(url, json=item_payload(empresa["id"], incoterm="XYZ")).status_code == 422
    assert client.put(url, json=item_payload(
        empresa["id"], impuestos_pct=0.5, recargos=[{"concepto": "baf", "porcentaje": 0.04}])).status_code == 422
    assert client.put(url, json=item_payload(9999)).status_code == 404  # empresa inexistente
    # Un intento fallido no modifica el ítem.
    assert client.get("/api/items").json()[0]["origen"] == "Shanghai"


def test_actualizar_item_inexistente_es_404(client, empresa, puertos):
    assert client.put("/api/items/9999", json=item_payload(empresa["id"])).status_code == 404


def test_actualizar_item_legacy_completa_los_datos_nuevos(client, empresa, puertos):
    with SessionLocal() as db:
        legacy = models.Item(
            empresa_id=empresa["id"], tipo=models.TipoItem.lcl, descripcion="Legacy", origen="Shanghai",
            destino="Cartagena", unidad_tarifa=models.UnidadTarifa.por_cbm_wm, costo_base=95,
            impuestos_pct=0.04, tipo_importacion=models.TipoImportacion.importacion, vigencia_dias=25,
            fecha_creacion=datetime.now(timezone.utc),
        )
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id
    r = client.put(f"/api/items/{legacy_id}", json=item_payload(empresa["id"]))
    assert r.status_code == 200 and r.json()["incoterm"] == "FOB"


def test_editar_item_no_altera_cotizaciones_ya_emitidas(client, empresa, puertos):
    from app.pdf.generator import render_cotizacion_html
    from app.routers.cotizaciones import _con_relaciones

    item = _crear(client, empresa, descripcion="Original", incoterm="FOB", transito_dias=32)
    cot = client.post("/api/cotizaciones", json={
        "item_id": item["id"], "cliente_nombre": "ACME", "tipo_margen": "porcentaje_total", "valor_margen": 10,
    }).json()

    client.put(f"/api/items/{item['id']}", json=item_payload(
        empresa["id"], descripcion="Modificada", incoterm="DDP", transito_dias=99, destino="Shanghai", origen="Cartagena",
    ))

    ci = client.get(f"/api/cotizaciones/{cot['id']}").json()["items"][0]
    assert (ci["descripcion"], ci["incoterm"], ci["transito_dias"]) == ("Original", "FOB", 32)
    assert (ci["origen"], ci["destino"], ci["empresa_nombre"]) == ("Shanghai", "Cartagena", "Maersk")

    with SessionLocal() as db:
        html = render_cotizacion_html(_con_relaciones(db, cot["id"]))
    assert "Original" in html and "Incoterm FOB" in html and "Tránsito 32 días" in html
    assert "Modificada" not in html and "DDP" not in html and "99" not in html
    assert "Shanghai &rarr; Cartagena" in html


def test_eliminar_item_inexistente_es_404(client):
    assert client.delete("/api/items/9999").status_code == 404


def test_pdf_conserva_el_nombre_de_empresa_de_la_emision(client, empresa, puertos):
    """No hay API para renombrar empresas, pero el snapshot debe resistirlo igualmente."""
    from app.pdf.generator import render_cotizacion_html
    from app.routers.cotizaciones import _con_relaciones

    item = _crear(client, empresa)
    cot = client.post("/api/cotizaciones", json={
        "item_id": item["id"], "cliente_nombre": "ACME", "tipo_margen": "porcentaje_total", "valor_margen": 10,
    }).json()
    with SessionLocal() as db:
        db.get(models.Empresa, empresa["id"]).nombre = "Renombrada S.A."
        db.commit()
        html = render_cotizacion_html(_con_relaciones(db, cot["id"]))
    assert "Maersk" in html and "Renombrada" not in html
