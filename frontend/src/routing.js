// Rutas por hash (sin librería): "#/cargador/<pestaña>" o "#/comercial".
// Cualquier otra cosa vuelve al selector de rol.
export const PESTANAS_CARGADOR = ["empresas", "puertos", "items", "config"];

export function parseHash(hash) {
  const partes = String(hash ?? "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const [rol, pestana] = partes;
  if (rol === "comercial" && partes.length === 1) return { rol: "comercial", tab: null };
  if (rol === "cargador" && partes.length <= 2) {
    if (!pestana) return { rol: "cargador", tab: "empresas" };
    if (PESTANAS_CARGADOR.includes(pestana)) return { rol: "cargador", tab: pestana };
  }
  return { rol: null, tab: null };
}

export function buildHash({ rol, tab }) {
  if (rol === "comercial") return "#/comercial";
  if (rol === "cargador") return `#/cargador/${tab ?? "empresas"}`;
  return "#/";
}
