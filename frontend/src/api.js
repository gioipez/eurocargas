const BASE = "/api";

// Nombres legibles de los campos que valida el backend (claves = nombres del schema).
const CAMPOS = {
  nombre: "Nombre",
  tipo: "Tipo",
  codigo: "Código",
  pais: "País",
  empresa_id: "Empresa",
  descripcion: "Descripción",
  origen: "Origen",
  destino: "Destino",
  unidad_tarifa: "Unidad de tarifa",
  costo_base: "Costo base",
  impuestos_pct: "Recargos consolidados",
  tipo_importacion: "Tipo de importación",
  vigencia_dias: "Vigencia",
  transito_dias: "Tránsito",
  frecuencia: "Frecuencia de salidas",
  incoterm: "Incoterm",
  recargos: "Recargos",
  tasa_cambio_usd_cop: "Tasa de cambio",
  item_id: "Ítem",
  cantidad: "Cantidad",
  cliente_nombre: "Cliente",
  moneda: "Moneda",
  tasa_cambio: "Tasa de cambio",
  tipo_margen: "Tipo de margen",
  valor_margen: "Valor del margen",
};

// Traducción de los tipos de error más comunes de FastAPI/Pydantic; el resto conserva el `msg` original.
function traducir(e) {
  const ctx = e.ctx ?? {};
  switch (e.type) {
    case "missing": return "es obligatorio";
    case "string_pattern_mismatch": return "el formato no es válido";
    case "string_too_short": return "no puede estar vacío";
    case "greater_than": return `debe ser mayor que ${ctx.gt}`;
    case "greater_than_equal": return `debe ser mayor o igual a ${ctx.ge}`;
    case "less_than": return `debe ser menor que ${ctx.lt}`;
    case "less_than_equal": return `debe ser menor o igual a ${ctx.le}`;
    case "int_parsing":
    case "int_type": return "debe ser un número entero";
    case "float_parsing":
    case "float_type": return "debe ser un número";
    case "enum": return "no es un valor permitido";
    // Validadores propios del backend: su mensaje ya está en español.
    case "value_error": return String(e.msg ?? "").replace(/^Value error,\s*/, "") || "valor no válido";
    default: return typeof e.msg === "string" && e.msg ? e.msg : "valor no válido";
  }
}

// `loc` es p. ej. ["body", "codigo"] o ["body", "recargos", 0, "porcentaje"]: el campo es el primero tras la ubicación.
function campoDe(loc) {
  const partes = (Array.isArray(loc) ? loc : []).filter((p) => !["body", "query", "path"].includes(p));
  return typeof partes[0] === "string" ? partes[0] : null;
}

// Convierte el cuerpo de error del backend en { mensaje, campos } legible; nunca "[object Object]".
export function normalizarError(body, status) {
  const detail = body?.detail;
  if (typeof detail === "string" && detail) return { mensaje: detail, campos: {} };

  const lista = Array.isArray(detail) ? detail : detail && typeof detail === "object" ? [detail] : [];
  const errores = lista.filter((e) => e && typeof e === "object");
  if (errores.length) {
    const campos = {};
    const lineas = errores.map((e) => {
      const campo = campoDe(e.loc);
      const texto = traducir(e);
      if (!campo) return texto.charAt(0).toUpperCase() + texto.slice(1);
      if (!(campo in campos)) campos[campo] = texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
      return `${CAMPOS[campo] ?? campo}: ${texto}`;
    });
    return { mensaje: [...new Set(lineas)].join(". ") + ".", campos };
  }
  return { mensaje: `Error ${status}: no se pudo completar la operación.`, campos: {} };
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { mensaje, campos } = normalizarError(body, res.status);
    const error = new Error(mensaje);
    error.status = res.status;
    error.campos = campos; // errores por campo (clave = nombre del campo en el backend)
    throw error;
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
