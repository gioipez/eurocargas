import re
from datetime import datetime, timedelta, timezone

import pytest

from app.database import SessionLocal
from app.pdf.generator import render_cotizacion_html
from app.routers.cotizaciones import _con_relaciones

from .conftest import item_payload


def _item(client, empresa, **overrides):
    r = client.post("/api/items", json=item_payload(empresa["id"], **overrides))
    assert r.status_code == 201, r.text
    return r.json()


def _cotizar(client, item, **overrides):
    payload = {
        "item_id": item["id"], "cliente_nombre": "ACME", "tipo_margen": "porcentaje_total", "valor_margen": 10,
    }
    payload.update(overrides)
    return client.post("/api/cotizaciones", json=payload)


@pytest.mark.parametrize(
    "tipo_margen, valor, margen_esperado",
    [
        ("porcentaje_total", 10, 280.0),   # 10% de 2800
        ("porcentaje_item", 10, 280.0),
        ("monto_fijo_total", 150, 150.0),
        ("monto_fijo_item", 150, 150.0),
        ("porcentaje_total", 0, 0.0),
    ],
)
def test_tipos_de_margen(client, empresa, puertos, tipo_margen, valor, margen_esperado):
    item = _item(client, empresa)  # 2800, sin recargos
    ci = _cotizar(client, item, tipo_margen=tipo_margen, valor_margen=valor).json()["items"][0]
    assert ci["costo_original"] == 2800
    assert abs(ci["margen_aplicado"] - margen_esperado) < 1e-9
    assert abs(ci["precio_final"] - (2800 + margen_esperado)) < 1e-9


def test_contenedor_ignora_la_cantidad_y_por_kg_la_multiplica(client, empresa, puertos):
    fcl = _item(client, empresa)  # por_contenedor
    aereo = _item(client, empresa, tipo="carga_aerea", unidad_tarifa="por_kg", costo_base=4.5, impuestos_pct=0.06)

    ci_fcl = _cotizar(client, fcl, cantidad=5).json()["items"][0]
    assert ci_fcl["cantidad"] == 1 and ci_fcl["costo_original"] == 2800

    ci_aereo = _cotizar(client, aereo, cantidad=100).json()["items"][0]
    assert ci_aereo["cantidad"] == 100
    assert abs(ci_aereo["costo_original"] - 4.5 * 100 * 1.06) < 1e-9  # recargos sobre el costo base total


def test_consecutivo_incrementa_y_usa_el_anio_actual(client, empresa, puertos):
    item = _item(client, empresa)
    anio = datetime.now(timezone.utc).year
    assert _cotizar(client, item).json()["consecutivo"] == f"COT-{anio}-0001"
    assert _cotizar(client, item).json()["consecutivo"] == f"COT-{anio}-0002"


def test_vigencia_es_creacion_del_item_mas_vigencia_dias(client, empresa, puertos):
    item = _item(client, empresa, vigencia_dias=15)
    esperado = (datetime.fromisoformat(item["fecha_creacion"]) + timedelta(days=15)).date().isoformat()
    assert _cotizar(client, item).json()["vigencia_hasta"][:10] == esperado


def test_cop_usa_la_tasa_global_si_no_se_envia(client, empresa, puertos):
    client.put("/api/config", json={"tasa_cambio_usd_cop": 4100})
    cot = _cotizar(client, _item(client, empresa), moneda="COP").json()
    assert cot["moneda"] == "COP" and cot["tasa_cambio"] == 4100


def test_cop_con_tasa_explicita_sobreescribe_la_global(client, empresa, puertos):
    cot = _cotizar(client, _item(client, empresa), moneda="COP", tasa_cambio=3900).json()
    assert cot["tasa_cambio"] == 3900


def test_pdf_en_cop_convierte_los_montos_con_la_tasa(client, empresa, puertos):
    cot = _cotizar(client, _item(client, empresa), moneda="COP", tasa_cambio=4000).json()  # precio 3080 USD
    with SessionLocal() as db:
        html = render_cotizacion_html(_con_relaciones(db, cot["id"]))
    assert "COP $12,320,000.00" in html  # 3080 * 4000
    assert "4000.00 COP/USD" in html


def test_pdf_en_usd_no_aplica_tasa(client, empresa, puertos):
    cot = _cotizar(client, _item(client, empresa)).json()
    with SessionLocal() as db:
        html = render_cotizacion_html(_con_relaciones(db, cot["id"]))
    assert "$3,080.00" in html and "COP $" not in html


def test_pdf_sin_snapshot_de_condiciones_omite_la_linea(client, empresa, puertos):
    """Cotizaciones antiguas sin incoterm/tránsito/frecuencia no deben mostrar 'None'."""
    cot = _cotizar(client, _item(client, empresa)).json()
    with SessionLocal() as db:
        c = _con_relaciones(db, cot["id"])
        ci = c.items[0]
        ci.incoterm = ci.transito_dias = ci.frecuencia = None
        html = render_cotizacion_html(c)
        db.rollback()
    assert "Incoterm" not in html and "None" not in html


def test_obtener_cotizacion_y_pdf(client, empresa, puertos):
    cot = _cotizar(client, _item(client, empresa)).json()
    assert client.get(f"/api/cotizaciones/{cot['id']}").json()["consecutivo"] == cot["consecutivo"]
    pdf = client.get(f"/api/cotizaciones/{cot['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert re.search(r'filename="COT-\d{4}-0001\.pdf"', pdf.headers["content-disposition"])


def test_404s(client):
    assert _cotizar(client, {"id": 9999}).status_code == 404
    assert client.get("/api/cotizaciones/9999").status_code == 404
    assert client.get("/api/cotizaciones/9999/pdf").status_code == 404


def test_validaciones_de_entrada(client, empresa, puertos):
    item = _item(client, empresa)
    for overrides in (
        {"cantidad": 0}, {"valor_margen": -1}, {"tasa_cambio": 0}, {"tipo_margen": "nada"}, {"moneda": "EUR"},
    ):
        assert _cotizar(client, item, **overrides).status_code == 422, overrides
    assert client.get("/api/cotizaciones/1").status_code == 404  # ninguna se creó
