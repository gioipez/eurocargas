def test_crea_la_configuracion_por_defecto_en_el_primer_acceso(client):
    assert client.get("/api/config").json() == {"tasa_cambio_usd_cop": 4000.0}


def test_actualiza_la_tasa_y_persiste(client):
    assert client.put("/api/config", json={"tasa_cambio_usd_cop": 4250.5}).json()["tasa_cambio_usd_cop"] == 4250.5
    assert client.get("/api/config").json()["tasa_cambio_usd_cop"] == 4250.5


def test_tasa_no_positiva_es_422(client):
    for valor in (0, -1):
        assert client.put("/api/config", json={"tasa_cambio_usd_cop": valor}).status_code == 422


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
