import { describe, expect, it } from "vitest";
import { estadoVigencia, formatRecargos, formatTransito, formatUsd, frecuenciaLabel, textoPorVencer } from "../labels.js";
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

  it("formatTransito usa singular para 1 día", () => {
    expect(formatTransito(1)).toBe("1 día");
    expect(formatTransito(2)).toBe("2 días");
  });

  it("formatUsd agrega miles y siempre dos decimales, sin depender del idioma", () => {
    expect(formatUsd(2996)).toBe("$2,996.00");
    expect(formatUsd(12320000)).toBe("$12,320,000.00");
    expect(formatUsd(3156.5)).toBe("$3,156.50");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(4.77)).toBe("$4.77");
  });

  describe("estadoVigencia", () => {
    const ahora = new Date("2026-01-15T23:59:00Z");
    it.each([
      ["2026-01-14", "vencida", -1],
      ["2026-01-15", "por_vencer", 0],
      ["2026-01-16", "por_vencer", 1],
      ["2026-01-22", "por_vencer", 7],
      ["2026-01-23", "vigente", 8],
    ])("%s -> %s", (fecha, estado, dias) => {
      expect(estadoVigencia(fecha, ahora)).toEqual({ estado, dias });
    });

    it("compara por día calendario (UTC), no por hora", () => {
      expect(estadoVigencia("2026-01-15", new Date("2026-01-15T00:00:01Z")).estado).toBe("por_vencer");
      expect(estadoVigencia("2026-01-15", new Date("2026-01-16T00:00:01Z")).estado).toBe("vencida");
    });
  });

  it("textoPorVencer", () => {
    expect(textoPorVencer(0)).toBe("Vence hoy");
    expect(textoPorVencer(1)).toBe("Vence en 1 día");
    expect(textoPorVencer(5)).toBe("Vence en 5 días");
  });
});
