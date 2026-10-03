import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ComparisonTable from "../components/ComparisonTable.jsx";
import { fila, makeItem, makeLegacyItem } from "../test/fixtures.js";

const nombresEnOrden = () =>
  screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[1].textContent);

const item = (id, nombre, extra = {}) => makeItem({ id, empresa: { id, nombre, tipo: "naviera" }, ...extra });

function renderTabla(filas, props = {}) {
  return render(<ComparisonTable filas={filas} seleccionadoId={null} onSeleccionar={() => {}} {...props} />);
}

describe("ComparisonTable", () => {
  it("sin filas muestra el mensaje vacío", () => {
    renderTabla([]);
    expect(screen.getByText(/No hay empresas con ítems vigentes/)).toBeInTheDocument();
  });

  it("muestra recargos, incoterm, tránsito, frecuencia y costo total", () => {
    renderTabla([fila(makeItem(), 2996)]);
    const celdas = within(screen.getAllByRole("row")[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(celdas).toEqual(expect.arrayContaining(["BAF 4.0% · THC 3.0%", "FOB", "32 días", "Semanal", "$2996.00", "2026-01-31"]));
  });

  it("ordena por precio por defecto", () => {
    renderTabla([fila(item(1, "Cara"), 3000), fila(item(2, "Barata"), 2000), fila(item(3, "Media"), 2500)]);
    expect(nombresEnOrden()).toEqual(["Barata", "Media", "Cara"]);
  });

  it("ordena por tránsito, con 'sin dato' al final y desempate por precio", async () => {
    renderTabla([
      fila(item(1, "Lenta", { transito_dias: 40 }), 1000),
      fila(makeLegacyItem({ id: 2, empresa: { id: 2, nombre: "SinDato", tipo: "naviera" } }), 500),
      fila(item(3, "RapidaCara", { transito_dias: 20 }), 3000),
      fila(item(4, "RapidaBarata", { transito_dias: 20 }), 2000),
    ]);
    await userEvent.selectOptions(screen.getByLabelText("Ordenar por"), "transito");
    expect(nombresEnOrden()).toEqual(["RapidaBarata", "RapidaCara", "Lenta", "SinDato"]);
  });

  it("no muta el arreglo recibido al ordenar", async () => {
    const filas = [fila(item(1, "Cara"), 3000), fila(item(2, "Barata"), 2000)];
    renderTabla(filas);
    expect(filas.map((f) => f.item.id)).toEqual([1, 2]);
  });

  it("advierte cuando los Incoterms difieren", () => {
    renderTabla([fila(item(1, "A", { incoterm: "FOB" }), 1), fila(item(2, "B", { incoterm: "CIF" }), 2)]);
    expect(screen.getByText(/no cubren el mismo Incoterm/)).toHaveTextContent("FOB, CIF");
  });

  it("no advierte cuando todos comparten Incoterm", () => {
    renderTabla([fila(item(1, "A"), 1), fila(item(2, "B"), 2)]);
    expect(screen.queryByText(/no cubren el mismo Incoterm/)).not.toBeInTheDocument();
  });

  it("trata 'sin dato' como un Incoterm distinto", () => {
    renderTabla([fila(item(1, "A"), 1), fila(makeLegacyItem(), 2)]);
    expect(screen.getByText(/no cubren el mismo Incoterm/)).toHaveTextContent("sin dato");
    expect(screen.getAllByText("Sin dato").length).toBeGreaterThan(0);
  });

  it("no advierte con una sola oferta, aunque sea legacy", () => {
    renderTabla([fila(makeLegacyItem(), 1)]);
    expect(screen.queryByText(/no cubren el mismo Incoterm/)).not.toBeInTheDocument();
  });

  it("selecciona una fila y marca la seleccionada", async () => {
    const onSeleccionar = vi.fn();
    renderTabla([fila(item(1, "A"), 1), fila(item(2, "B"), 2)], { onSeleccionar, seleccionadoId: 2 });
    const radios = screen.getAllByRole("radio");
    expect(radios[1]).toBeChecked();
    await userEvent.click(radios[0]);
    expect(onSeleccionar).toHaveBeenCalledWith(1);
  });
});
