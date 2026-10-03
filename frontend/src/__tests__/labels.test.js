import { describe, expect, it } from "vitest";
import { formatRecargos, formatTransito, frecuenciaLabel } from "../labels.js";
import { makeItem, makeLegacyItem } from "../test/fixtures.js";

describe("labels", () => {
  it("formatRecargos lista el desglose con siglas y porcentajes", () => {
    expect(formatRecargos(makeItem())).toBe("BAF 4.0% · THC 3.0%");
  });

  it("formatRecargos sin desglose muestra el consolidado", () => {
    expect(formatRecargos(makeLegacyItem())).toBe("8.0% (consolidado)");
  });

  it("formatTransito distingue 'sin dato' de un valor", () => {
    expect(formatTransito(32)).toBe("32 días");
    expect(formatTransito(null)).toBe("Sin dato");
    expect(formatTransito(undefined)).toBe("Sin dato");
  });

  it("frecuenciaLabel traduce y degrada a 'Sin dato'", () => {
    expect(frecuenciaLabel("quincenal")).toBe("Quincenal");
    expect(frecuenciaLabel(null)).toBe("Sin dato");
  });
});
