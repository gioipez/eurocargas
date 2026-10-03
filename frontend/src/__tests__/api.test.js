import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";

function mockFetch(response) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const ok = (body, status = 200) => ({ ok: true, status, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("GET usa /api y devuelve el JSON", async () => {
    const fetchFn = mockFetch(ok([{ id: 1 }]));
    expect(await api.listarItems()).toEqual([{ id: 1 }]);
    expect(fetchFn).toHaveBeenCalledWith("/api/items", expect.objectContaining({ headers: { "Content-Type": "application/json" } }));
  });

  it("POST envía el cuerpo serializado", async () => {
    const fetchFn = mockFetch(ok({ id: 1 }, 201));
    await api.crearPuerto({ nombre: "X" });
    expect(fetchFn).toHaveBeenCalledWith("/api/puertos", expect.objectContaining({ method: "POST", body: '{"nombre":"X"}' }));
  });

  it("PUT de ítems apunta al id", async () => {
    const fetchFn = mockFetch(ok({}));
    await api.actualizarItem(7, { a: 1 });
    expect(fetchFn).toHaveBeenCalledWith("/api/items/7", expect.objectContaining({ method: "PUT", body: '{"a":1}' }));
  });

  it("DELETE 204 devuelve null sin parsear el cuerpo", async () => {
    const json = vi.fn();
    mockFetch({ ok: true, status: 204, json });
    expect(await api.eliminarItem(1)).toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it("propaga el detail del backend como mensaje de error", async () => {
    mockFetch({ ok: false, status: 422, json: async () => ({ detail: "El origen no está en el catálogo" }) });
    await expect(api.crearItem({})).rejects.toThrow("El origen no está en el catálogo");
  });

  it("sin detail usa el código HTTP", async () => {
    mockFetch({ ok: false, status: 500, json: async () => { throw new Error("no json"); } });
    await expect(api.listarItems()).rejects.toThrow("Error 500");
  });

  it("expone la URL de descarga del PDF", () => {
    expect(api.descargarPdfUrl(3)).toBe("/api/cotizaciones/3/pdf");
  });

  // Cada wrapper debe apuntar al método y ruta que expone el backend.
  it.each([
    ["listarEmpresas", [], "GET", "/api/empresas"],
    ["crearEmpresa", [{}], "POST", "/api/empresas"],
    ["eliminarEmpresa", [4], "DELETE", "/api/empresas/4"],
    ["listarPuertos", [], "GET", "/api/puertos"],
    ["crearPuerto", [{}], "POST", "/api/puertos"],
    ["eliminarPuerto", [4], "DELETE", "/api/puertos/4"],
    ["listarItems", [], "GET", "/api/items"],
    ["crearItem", [{}], "POST", "/api/items"],
    ["actualizarItem", [4, {}], "PUT", "/api/items/4"],
    ["eliminarItem", [4], "DELETE", "/api/items/4"],
    ["obtenerConfig", [], "GET", "/api/config"],
    ["actualizarConfig", [{}], "PUT", "/api/config"],
    ["crearCotizacion", [{}], "POST", "/api/cotizaciones"],
  ])("%s -> %s %s", async (nombre, args, metodo, ruta) => {
    const fetchFn = mockFetch(ok({}));
    await api[nombre](...args);
    const [url, opciones] = fetchFn.mock.calls[0];
    expect(url).toBe(ruta);
    expect(opciones.method ?? "GET").toBe(metodo);
  });
});
