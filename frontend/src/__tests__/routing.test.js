import { describe, expect, it } from "vitest";
import { buildHash, parseHash } from "../routing.js";

describe("routing", () => {
  it.each([
    ["#/comercial", { rol: "comercial", tab: null }],
    ["#/cargador", { rol: "cargador", tab: "empresas" }],
    ["#/cargador/items", { rol: "cargador", tab: "items" }],
    ["#/cargador/config", { rol: "cargador", tab: "config" }],
    ["", { rol: null, tab: null }],
    ["#/", { rol: null, tab: null }],
    ["#/admin", { rol: null, tab: null }],
    ["#/cargador/otra", { rol: null, tab: null }],
    ["#/comercial/extra", { rol: null, tab: null }],
  ])("parseHash(%j)", (hash, esperado) => {
    expect(parseHash(hash)).toEqual(esperado);
  });

  it("buildHash es el inverso de parseHash", () => {
    for (const ruta of [{ rol: "comercial", tab: null }, { rol: "cargador", tab: "puertos" }, { rol: null, tab: null }]) {
      expect(parseHash(buildHash(ruta))).toEqual(ruta);
    }
  });
});
