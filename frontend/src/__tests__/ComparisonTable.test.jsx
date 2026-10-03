import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ComparisonTable from "../components/ComparisonTable.jsx";
import { fila, makeItem, makeLegacyItem } from "../test/fixtures.js";

const nombresEnOrden = () =>
  screen.getAllByRole("row").slice(1).map((r) => r.querySelector(".empresa-nombre")?.textContent).filter(Boolean);

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
    expect(celdas).toEqual(expect.arrayContaining(["BAF 4.0% · THC 3.0%", "FOB", "32 días", "Semanal", "$2,996.00", "2026-01-31"]));
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

  it("sin agrupar: un solo servicio no muestra encabezados de grupo", () => {
    renderTabla([fila(item(1, "A"), 1), fila(item(2, "B"), 2)]);
    expect(document.querySelector(".grupo-header")).toBeNull();
    expect(screen.getByText("2 ofertas")).toBeInTheDocument();
  });

  describe("agrupación por servicio", () => {
    const veinte = (id, nombre, costo, extra = {}) => fila(item(id, nombre, { descripcion: "Contenedor 20' estándar", ...extra }), costo);
    const cuarenta = (id, nombre, costo, extra = {}) => fila(item(id, nombre, { descripcion: "Contenedor 40' estándar", ...extra }), costo);

    it("separa 20' de 40' con encabezados y no mezcla sus precios", () => {
      renderTabla([cuarenta(1, "Cara40", 3000), veinte(2, "Barata20", 1000), cuarenta(3, "Barata40", 2800), veinte(4, "Cara20", 1500)]);
      const encabezados = [...document.querySelectorAll(".grupo-header")].map((e) => e.textContent);
      expect(encabezados).toEqual(["Contenedor 20' estándar · 2 ofertas", "Contenedor 40' estándar · 2 ofertas"]);
      // La más barata global (20') no queda por delante de las 40': cada grupo se ordena por separado.
      expect(nombresEnOrden()).toEqual(["Barata20", "Cara20", "Barata40", "Cara40"]);
      expect(screen.getByText(/4 ofertas en 2 servicios/)).toBeInTheDocument();
    });

    it("el aviso de Incoterm es por grupo, no global", () => {
      renderTabla([
        veinte(1, "A", 1, { incoterm: "FOB" }), veinte(2, "B", 2, { incoterm: "FOB" }),
        cuarenta(3, "C", 3, { incoterm: "FOB" }), cuarenta(4, "D", 4, { incoterm: "CIF" }),
      ]);
      const chips = screen.getAllByText(/Incoterms distintos/);
      expect(chips).toHaveLength(1);
      expect(chips[0].closest("tr")).toHaveTextContent("Contenedor 40' estándar");
      expect(screen.queryByText(/no cubren el mismo Incoterm/)).not.toBeInTheDocument(); // sin banner global
    });

    it("el orden por tránsito se aplica dentro de cada grupo", async () => {
      renderTabla([
        veinte(1, "Lenta20", 1, { transito_dias: 40 }), veinte(2, "Rapida20", 2, { transito_dias: 10 }),
        cuarenta(3, "Lenta40", 3, { transito_dias: 50 }), cuarenta(4, "Rapida40", 4, { transito_dias: 20 }),
      ]);
      await userEvent.selectOptions(screen.getByLabelText("Ordenar por"), "transito");
      expect(nombresEnOrden()).toEqual(["Rapida20", "Lenta20", "Rapida40", "Lenta40"]);
    });
  });

  describe("vigencia", () => {
    // La fecha del sistema en los tests es 2026-01-15.
    const conVigencia = (id, nombre, vigenciaHasta) => fila(item(id, nombre), 1, vigenciaHasta);

    it("marca vencida (atenuada), vence hoy, vence en N días y no marca las vigentes", () => {
      renderTabla([
        conVigencia(1, "Atrasada", "2026-01-14"), conVigencia(2, "Hoy", "2026-01-15"),
        conVigencia(3, "En3", "2026-01-18"), conVigencia(4, "En1", "2026-01-16"),
        conVigencia(5, "Limite", "2026-01-22"), conVigencia(6, "Vigente", "2026-01-23"),
      ]);
      const fila_ = (n) => screen.getByText(n).closest("tr");
      expect(within(fila_("Atrasada")).getByText("Vencida")).toBeInTheDocument();
      expect(fila_("Atrasada")).toHaveClass("vencida");
      expect(within(fila_("Hoy")).getByText("Vence hoy")).toBeInTheDocument();
      expect(within(fila_("En3")).getByText("Vence en 3 días")).toBeInTheDocument();
      expect(within(fila_("En1")).getByText("Vence en 1 día")).toBeInTheDocument();
      expect(within(fila_("Limite")).getByText("Vence en 7 días")).toBeInTheDocument(); // 7 días: aún avisa
      expect(fila_("Vigente").querySelector(".chip")).toBeNull(); // 8 días: no avisa
      expect(fila_("Vigente")).not.toHaveClass("vencida");
    });

    it("una oferta vencida sigue siendo seleccionable (el aviso no bloquea)", async () => {
      const onSeleccionar = vi.fn();
      renderTabla([conVigencia(1, "Atrasada", "2026-01-01")], { onSeleccionar });
      await userEvent.click(screen.getByRole("radio"));
      expect(onSeleccionar).toHaveBeenCalledWith(1);
    });
  });

  describe("selección", () => {
    it("clic en cualquier parte de la fila selecciona", async () => {
      const onSeleccionar = vi.fn();
      renderTabla([fila(item(1, "A"), 1), fila(item(2, "B"), 2)], { onSeleccionar });
      await userEvent.click(screen.getByText("B"));
      expect(onSeleccionar).toHaveBeenCalledWith(2);
    });

    it("clic en el radio notifica una sola vez (sin duplicar por el clic de la fila)", async () => {
      const onSeleccionar = vi.fn();
      renderTabla([fila(item(1, "A"), 1)], { onSeleccionar });
      await userEvent.click(screen.getByRole("radio"));
      expect(onSeleccionar).toHaveBeenCalledTimes(1);
    });

    it("los radios tienen un nombre accesible con empresa y servicio", () => {
      renderTabla([fila(item(1, "Maersk"), 1)]);
      expect(screen.getByRole("radio", { name: "Seleccionar Maersk · Contenedor 40' estándar" })).toBeInTheDocument();
    });
  });
});
