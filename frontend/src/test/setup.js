import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Fecha fija: las vigencias de los fixtures (enero de 2026) y los avisos de vencimiento deben ser deterministas.
// Solo se falsea Date; los temporizadores reales siguen funcionando con userEvent y waitFor.
export const AHORA = new Date("2026-01-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// jsdom no implementa scrollTo (lo usa el modo edición de ítems).
window.scrollTo = vi.fn();
