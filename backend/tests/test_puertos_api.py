from .conftest import item_payload


def test_crea_y_lista(client):
    r = client.post("/api/puertos", json={"nombre": "Cartagena", "codigo": "COCTG", "pais": "Colombia"})
    assert r.status_code == 201
    assert [p["nombre"] for p in client.get("/api/puertos").json()] == ["Cartagena"]


def test_nombre_duplicado_sin_distinguir_mayusculas_es_409(client):
    client.post("/api/puertos", json={"nombre": "Cartagena"})
    assert client.post("/api/puertos", json={"nombre": " cartagena "}).status_code == 409


def test_codigo_duplicado_es_409(client):
    client.post("/api/puertos", json={"nombre": "Cartagena", "codigo": "COCTG"})
    assert client.post("/api/puertos", json={"nombre": "Otra", "codigo": "COCTG"}).status_code == 409


def test_varios_puertos_sin_codigo_son_validos(client):
    assert client.post("/api/puertos", json={"nombre": "A"}).status_code == 201
    assert client.post("/api/puertos", json={"nombre": "B"}).status_code == 201


def test_codigo_con_formato_invalido_es_422(client):
    for codigo in ("coctg", "CO", "COCTGX", "12345"):
        assert client.post("/api/puertos", json={"nombre": "X", "codigo": codigo}).status_code == 422, codigo


def test_no_se_elimina_un_puerto_en_uso(client, empresa, puertos):
    client.post("/api/items", json=item_payload(empresa["id"]))
    shanghai = next(p for p in client.get("/api/puertos").json() if p["nombre"] == "Shanghai")
    assert client.delete(f"/api/puertos/{shanghai['id']}").status_code == 409


def test_se_elimina_un_puerto_sin_uso(client):
    pid = client.post("/api/puertos", json={"nombre": "Libre"}).json()["id"]
    assert client.delete(f"/api/puertos/{pid}").status_code == 204
    assert client.delete(f"/api/puertos/{pid}").status_code == 404


def test_nombre_en_blanco_es_422(client):
    assert client.post("/api/puertos", json={"nombre": "   "}).status_code == 422
