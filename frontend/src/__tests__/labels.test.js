import { describe, expect, it } from "vitest";
import {
  estadoVigencia, formatCop, formatDelta, formatFecha, formatMoneda, formatRecargos, formatTransito, formatUsd, frecuenciaLabel,
  textoPorVencer, tipoEmpresaLabel, tipoImportacionLabel, tipoItemLabel, vigenciaHasta,
} from "../labels.js";
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

  it("formatUsd agrega código de moneda, miles y siempre dos decimales, sin depender del idioma", () => {
    expect(formatUsd(2996)).toBe("USD 2,996.00");
    expect(formatUsd(12320000)).toBe("USD 12,320,000.00");
    expect(formatUsd(3156.5)).toBe("USD 3,156.50");
    expect(formatUsd(0)).toBe("USD 0.00");
    expect(formatUsd(4.77)).toBe("USD 4.77");
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

  it("formatCop usa código y redondea a pesos enteros", () => {
    expect(formatCop(12852840)).toBe("COP 12,852,840");
    expect(formatCop(13182400.4)).toBe("COP 13,182,400");
  });

  it("formatMoneda elige el formato según la moneda", () => {
    expect(formatMoneda(3295.6, "USD")).toBe("USD 3,295.60");
    expect(formatMoneda(12852840, "COP")).toBe("COP 12,852,840");
  });

  it("formatDelta muestra la diferencia en USD y en porcentaje", () => {
    expect(formatDelta(160.5, 2996)).toBe("+USD 160.50 · +5.4%");
    expect(formatDelta(120, 1500)).toBe("+USD 120.00 · +8%");
    expect(formatDelta(0, 0)).toBe("+USD 0.00 · +0%");
  });

  it("formatFecha es legible en español y no depende de la zona horaria ni del idioma", () => {
    expect(formatFecha("2026-01-31")).toBe("31 ene 2026");
    expect(formatFecha("2025-12-01T00:00:00")).toBe("1 dic 2025");
    expect(formatFecha("2026-09-05")).toBe("5 sep 2026");
    expect(formatFecha("")).toBe("");
    expect(formatFecha("no-es-fecha")).toBe("no-es-fecha");
  });

  it("etiquetas humanas para los enums, con el valor crudo si es desconocido", () => {
    expect(tipoEmpresaLabel("aerolinea")).toBe("Aerolínea");
    expect(tipoImportacionLabel("exportacion")).toBe("Exportación");
    expect(tipoItemLabel("lcl")).toBe("LCL / Fragmento");
    expect(tipoEmpresaLabel("nuevo_tipo")).toBe("nuevo_tipo");
  });

  it("vigenciaHasta suma los días de vigencia a la fecha de creación", () => {
    expect(vigenciaHasta({ fecha_creacion: "2026-01-01T12:00:00", vigencia_dias: 30 })).toBe("2026-01-31");
  });
});
