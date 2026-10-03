const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listarEmpresas: () => request("/empresas"),
  crearEmpresa: (data) => request("/empresas", { method: "POST", body: JSON.stringify(data) }),
  eliminarEmpresa: (id) => request(`/empresas/${id}`, { method: "DELETE" }),

  listarPuertos: () => request("/puertos"),
  crearPuerto: (data) => request("/puertos", { method: "POST", body: JSON.stringify(data) }),
  eliminarPuerto: (id) => request(`/puertos/${id}`, { method: "DELETE" }),

  listarItems: () => request("/items"),
  crearItem: (data) => request("/items", { method: "POST", body: JSON.stringify(data) }),
  actualizarItem: (id, data) => request(`/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  eliminarItem: (id) => request(`/items/${id}`, { method: "DELETE" }),

  obtenerConfig: () => request("/config"),
  actualizarConfig: (data) => request("/config", { method: "PUT", body: JSON.stringify(data) }),

  crearCotizacion: (data) => request("/cotizaciones", { method: "POST", body: JSON.stringify(data) }),
  descargarPdfUrl: (id) => `${BASE}/cotizaciones/${id}/pdf`,
};
