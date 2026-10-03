import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import WizardPage from "../pages/comercial/WizardPage.jsx";
import { makeItem } from "../test/fixtures.js";
import { cleanup } from "@testing-library/react";

vi.mock("../api.js");

const maersk = makeItem({ id: 1, costo_base: 2800, impuestos_pct: 0.07, incoterm: "FOB", transito_dias: 32 });
const hapag = makeItem({
  id: 2, empresa: { id: 2, nombre: "Hapag-Lloyd", tipo: "naviera" }, costo_base: 2950, impuestos_pct: 0.07,
  incoterm: "CIF", transito_dias: 28,
});
const avianca = makeItem({
  id: 3, empresa: { id: 3, nombre: "Avianca", tipo: "aerolinea" }, tipo: "carga_aerea", unidad_tarifa: "por_kg",
  descripcion: "Carga aérea general", origen: "Miami", destino: "Bogota", costo_base: 4.5, impuestos_pct: 0.06,
  incoterm: "FCA", transito_dias: 3, recargos: [],
});

const cotizacion = (extra = {}) => ({
  id: 5, consecutivo: "COT-2026-0001", cliente_nombre: "ACME", moneda: "USD", tasa_cambio: 4000,
  vigencia_hasta: "2026-01-31T00:00:00", items: [{ precio_final: 3295.6 }], ...extra,
});

beforeEach(() => {
  api.listarItems.mockResolvedValue([maersk, hapag, avianca]);
  api.obtenerConfig.mockResolvedValue({ tasa_cambio_usd_cop: 4000 });
  api.crearCotizacion.mockResolvedValue(cotizacion());
  api.descargarPdfUrl.mockReturnValue("/api/cotizaciones/5/pdf");
});

const elegir = (re, valor) => userEvent.selectOptions(screen.getByLabelText(re), valor);

async function hastaElCuadro({ origen = "Shanghai", destino = "Cartagena", tipo = "contenedor_maritimo" } = {}) {
  render(<WizardPage />);
  await screen.findByRole("option", { name: origen });
  await elegir(/1\. Origen/, origen);
  await elegir(/2\. Destino/, destino);
  await elegir(/3\. Tipo de mercancía/, "importacion");
  await elegir(/4\. Tipo de ítem/, tipo);
}

const textosDeFila = (i) => within(screen.getAllByRole("row")[i]).getAllByRole("cell").map((c) => c.textContent);

describe("WizardPage — cuadro comparativo", () => {
  it("el wizard avanza por pasos y solo ofrece lo que existe", async () => {
    render(<WizardPage />);
    await screen.findByRole("option", { name: "Miami" });
    expect(screen.queryByLabelText(/2\. Destino/)).not.toBeInTheDocument();
    await elegir(/1\. Origen/, "Shanghai");
    expect(within(screen.getByLabelText(/2\. Destino/)).queryByRole("option", { name: "Bogota" })).not.toBeInTheDocument();
  });

  it("compara con costo total (base + recargos), ordenado por precio, vigencia y alerta de Incoterm", async () => {
    await hastaElCuadro();
    expect(textosDeFila(1)).toEqual(expect.arrayContaining(["Maersk", "$2,996.00", "2026-01-31"])); // 2800 * 1.07
    expect(textosDeFila(2)).toEqual(expect.arrayContaining(["Hapag-Lloyd", "$3,156.50"]));
    expect(screen.getByText(/no cubren el mismo Incoterm/)).toHaveTextContent("FOB, CIF");
  });

  it("carga aérea: pide cantidad y multiplica la tarifa por kg; sin cantidad válida oculta el cuadro", async () => {
    await hastaElCuadro({ origen: "Miami", destino: "Bogota", tipo: "carga_aerea" });
    expect(textosDeFila(1)).toContain("$4.77"); // 4.5 * 1 * 1.06

    const peso = screen.getByLabelText(/5\. Peso \(kg\)/);
    await userEvent.clear(peso);
    await userEvent.type(peso, "100");
    expect(textosDeFila(1)).toContain("$477.00"); // 4.5 * 100 * 1.06 (igual que el backend)

    await userEvent.clear(peso);
    await userEvent.type(peso, "0");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("contenedor: no pide cantidad y la tarifa es plana", async () => {
    await hastaElCuadro();
    expect(screen.queryByLabelText(/5\./)).not.toBeInTheDocument();
  });

  it("la cantidad que quedó de una carga aérea no altera la tarifa plana de un contenedor", async () => {
    await hastaElCuadro({ origen: "Miami", destino: "Bogota", tipo: "carga_aerea" });
    const peso = screen.getByLabelText(/Peso/);
    await userEvent.clear(peso);
    await userEvent.type(peso, "100");

    await elegir(/1\. Origen/, "Shanghai");
    await elegir(/2\. Destino/, "Cartagena");
    await elegir(/3\. Tipo de mercancía/, "importacion");
    await elegir(/4\. Tipo de ítem/, "contenedor_maritimo");
    expect(textosDeFila(1)).toContain("$2,996.00"); // sin multiplicar por los 100 kg anteriores
  });

  it("cambiar una selección previa reinicia las posteriores y la fila elegida", async () => {
    await hastaElCuadro();
    await userEvent.click(screen.getAllByRole("radio")[0]);
    expect(screen.getByText("Margen y datos de la cotización")).toBeInTheDocument();

    await elegir(/1\. Origen/, "Miami");
    expect(screen.getByLabelText(/2\. Destino/)).toHaveValue("");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Margen y datos de la cotización")).not.toBeInTheDocument();
  });

  it("muestra el error de carga inicial", async () => {
    api.listarItems.mockRejectedValue(new Error("sin conexión"));
    render(<WizardPage />);
    expect(await screen.findByText("sin conexión")).toBeInTheDocument();
  });
});

describe("WizardPage — generar cotización", () => {
  async function seleccionarMaersk() {
    await hastaElCuadro();
    await userEvent.click(screen.getAllByRole("radio")[0]); // Maersk es la más barata
    await userEvent.type(screen.getByLabelText("Cliente final"), "ACME");
  }

  it("USD: envía tasa null, margen por defecto 10% y muestra el resultado con el PDF", async () => {
    await seleccionarMaersk();
    await userEvent.click(screen.getByRole("button", { name: "Generar cotización y PDF" }));

    expect(api.crearCotizacion).toHaveBeenCalledWith({
      item_id: 1, cantidad: 1, cliente_nombre: "ACME", moneda: "USD", tasa_cambio: null,
      tipo_margen: "porcentaje_total", valor_margen: 10,
    });
    expect(await screen.findByText("Cotización generada")).toBeInTheDocument();
    expect(screen.getByText("COT-2026-0001")).toBeInTheDocument();
    expect(screen.getByText(/\$3,295\.6/)).toBeInTheDocument();
    expect(screen.getByText("Vigente hasta 2026-01-31")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Descargar PDF" })).toHaveAttribute("href", "/api/cotizaciones/5/pdf");
  });

  it("COP: propone la tasa global, permite sobreescribirla y muestra el precio convertido", async () => {
    api.crearCotizacion.mockResolvedValue(cotizacion({ moneda: "COP", tasa_cambio: 3900 }));
    await seleccionarMaersk();
    await elegir(/Moneda de la cotización/, "COP");
    const tasa = screen.getByLabelText(/Tasa de cambio/);
    expect(tasa).toHaveValue(4000);
    await userEvent.clear(tasa);
    await userEvent.type(tasa, "3900");
    await userEvent.click(screen.getByRole("button", { name: "Generar cotización y PDF" }));

    expect(api.crearCotizacion).toHaveBeenCalledWith(expect.objectContaining({ moneda: "COP", tasa_cambio: 3900 }));
    expect(await screen.findByText(/COP \$12,852,840/)).toBeInTheDocument(); // 3295.6 * 3900
  });

  it("envía el tipo y valor de margen elegidos y la cantidad aérea", async () => {
    await hastaElCuadro({ origen: "Miami", destino: "Bogota", tipo: "carga_aerea" });
    const peso = screen.getByLabelText(/Peso/);
    await userEvent.clear(peso);
    await userEvent.type(peso, "50");
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.type(screen.getByLabelText("Cliente final"), "ACME");
    await elegir(/Tipo de margen/, "monto_fijo_total");
    const valor = screen.getByLabelText(/^Valor/);
    await userEvent.clear(valor);
    await userEvent.type(valor, "150");
    await userEvent.click(screen.getByRole("button", { name: "Generar cotización y PDF" }));

    expect(api.crearCotizacion).toHaveBeenCalledWith(expect.objectContaining({
      item_id: 3, cantidad: 50, tipo_margen: "monto_fijo_total", valor_margen: 150,
    }));
  });

  it("muestra el error del backend sin salir del wizard", async () => {
    api.crearCotizacion.mockRejectedValue(new Error("Item no encontrado"));
    await seleccionarMaersk();
    await userEvent.click(screen.getByRole("button", { name: "Generar cotización y PDF" }));
    expect(await screen.findByText("Item no encontrado")).toBeInTheDocument();
    expect(screen.queryByText("Cotización generada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generar cotización y PDF" })).toBeEnabled();
  });

  it("'Nueva cotización' vuelve al wizard", async () => {
    await seleccionarMaersk();
    await userEvent.click(screen.getByRole("button", { name: "Generar cotización y PDF" }));
    await userEvent.click(await screen.findByRole("button", { name: "Nueva cotización" }));
    expect(screen.getByText("Wizard de cotización")).toBeInTheDocument();
    expect(screen.queryByText("Margen y datos de la cotización")).not.toBeInTheDocument();
  });
});

describe("WizardPage — UX", () => {
  async function conSeleccion() {
    await hastaElCuadro();
    await userEvent.click(screen.getAllByRole("radio")[0]); // Maersk 40': costo 2,996.00
  }

  it("muestra 'Cargando tarifas…' hasta que llegan los datos", async () => {
    let resolver;
    api.listarItems.mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<WizardPage />);
    expect(screen.getByText("Cargando tarifas…")).toBeInTheDocument();
    await act(async () => { resolver([maersk]); });
    expect(screen.queryByText("Cargando tarifas…")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/1\. Origen/)).toBeVisible();
  });

  it("sin tarifas cargadas explica qué hacer; con error no muestra ese estado vacío", async () => {
    api.listarItems.mockResolvedValue([]);
    render(<WizardPage />);
    expect(await screen.findByText(/Aún no hay tarifas cargadas/)).toBeInTheDocument();
    cleanup();

    api.listarItems.mockRejectedValue(new Error("sin conexión"));
    render(<WizardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("sin conexión");
    expect(screen.queryByText(/Aún no hay tarifas cargadas/)).not.toBeInTheDocument();
  });

  it("vista previa en USD: costo + margen = precio final estimado, y se actualiza con el margen", async () => {
    await conSeleccion();
    const vista = () => document.querySelector(".preview").textContent;
    expect(vista()).toContain("Costo $2,996.00");
    expect(vista()).toContain("Margen $299.60"); // 10% por defecto
    expect(vista()).toContain("Precio final estimado $3,295.60");

    await elegir(/Tipo de margen/, "monto_fijo_total");
    const valor = screen.getByLabelText(/^Valor/);
    await userEvent.clear(valor);
    await userEvent.type(valor, "150");
    expect(vista()).toContain("Margen $150.00");
    expect(vista()).toContain("Precio final estimado $3,146.00");
  });

  it("la vista previa coincide con lo que calcula el backend (misma fórmula que _calcular_costos)", async () => {
    await conSeleccion();
    await elegir(/Tipo de margen/, "porcentaje_item");
    const valor = screen.getByLabelText(/^Valor/);
    await userEvent.clear(valor);
    await userEvent.type(valor, "0");
    expect(document.querySelector(".preview").textContent).toContain("Precio final estimado $2,996.00");
  });

  it("en COP añade el equivalente con la tasa elegida", async () => {
    await conSeleccion();
    expect(document.querySelector(".preview").textContent).not.toContain("COP");
    await elegir(/Moneda de la cotización/, "COP");
    expect(document.querySelector(".preview").textContent).toContain("≈ COP $13,182,400"); // 3295.6 * 4000
    const tasa = screen.getByLabelText(/Tasa de cambio/);
    await userEvent.clear(tasa);
    await userEvent.type(tasa, "3900");
    expect(document.querySelector(".preview").textContent).toContain("≈ COP $12,852,840");
  });

  it("avisa (sin bloquear) cuando la tarifa seleccionada está vencida", async () => {
    api.listarItems.mockResolvedValue([makeItem({ id: 1, fecha_creacion: "2025-11-01T00:00:00", vigencia_dias: 30 })]);
    await hastaElCuadro();
    expect(screen.queryByText(/Esta tarifa venció/)).not.toBeInTheDocument(); // hasta elegir una
    await userEvent.click(screen.getByRole("radio"));
    expect(screen.getByRole("alert")).toHaveTextContent("Esta tarifa venció el 2025-12-01");
    await userEvent.type(screen.getByLabelText("Cliente final"), "ACME");
    await userEvent.click(screen.getByRole("button", { name: "Generar cotización y PDF" }));
    expect(api.crearCotizacion).toHaveBeenCalled(); // no bloquea
  });

  it("no avisa con una tarifa vigente", async () => {
    await conSeleccion();
    expect(screen.queryByText(/Esta tarifa venció/)).not.toBeInTheDocument();
  });

  it("separa 20' y 40' en grupos dentro del cuadro del wizard", async () => {
    const veinte = makeItem({ id: 7, descripcion: "Contenedor 20' estándar", costo_base: 1800, impuestos_pct: 0.07 });
    api.listarItems.mockResolvedValue([maersk, hapag, veinte]);
    await hastaElCuadro();
    expect([...document.querySelectorAll(".grupo-header")].map((e) => e.textContent.split(" · ")[0]))
      .toEqual(["Contenedor 20' estándar", "Contenedor 40' estándar"]);
  });
});
