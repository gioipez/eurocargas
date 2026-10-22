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

  it("422 con lista de errores de FastAPI: mensaje legible por campo, nunca [object Object]", async () => {
    mockFetch({
      ok: false, status: 422, json: async () => ({
        detail: [
          { type: "string_pattern_mismatch", loc: ["body", "codigo"], msg: "String should match pattern '^([A-Z]{3})$'", ctx: { pattern: "x" } },
          { type: "greater_than", loc: ["body", "costo_base"], msg: "Input should be greater than 0", ctx: { gt: 0 } },
        ],
      }),
    });
    const error = await api.crearPuerto({}).catch((e) => e);
    expect(error.message).toBe("Código: el formato no es válido. Costo base: debe ser mayor que 0.");
    expect(error.message).not.toContain("[object Object]");
    expect(error.status).toBe(422);
    expect(error.campos).toEqual({ codigo: "El formato no es válido.", costo_base: "Debe ser mayor que 0." });
  });

  it("422 con un tipo no traducido conserva el msg original y mapea el nombre del campo", async () => {
    mockFetch({ ok: false, status: 422, json: async () => ({ detail: [{ type: "otro", loc: ["body", "pais"], msg: "Algo raro" }] }) });
    await expect(api.crearPuerto({})).rejects.toThrow("País: Algo raro.");
  });

  it("422 de un validador propio quita el prefijo 'Value error' y sin campo deja solo el mensaje", async () => {
    mockFetch({
      ok: false, status: 422, json: async () => ({
        detail: [
          { type: "value_error", loc: ["body", "nombre"], msg: "Value error, El nombre no puede estar vacío" },
          { type: "value_error", loc: ["body"], msg: "Value error, Hay conceptos de recargo repetidos" },
        ],
      }),
    });
    await expect(api.crearPuerto({})).rejects.toThrow("Nombre: El nombre no puede estar vacío. Hay conceptos de recargo repetidos.");
  });

  it("detail como objeto suelto también se convierte en texto", async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ detail: { type: "missing", loc: ["body", "cliente_nombre"], msg: "Field required" } }) });
    await expect(api.crearCotizacion({})).rejects.toThrow("Cliente: es obligatorio.");
  });

  it("sin conexión con el servidor da un mensaje en español", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.listarItems()).rejects.toThrow("No se pudo conectar con el servidor");
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
