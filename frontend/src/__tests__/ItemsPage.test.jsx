import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import ItemsPage from "../pages/cargador/ItemsPage.jsx";
import { empresa, makeItem, makeLegacyItem, puertos } from "../test/fixtures.js";

vi.mock("../api.js");

beforeEach(() => {
  api.listarItems.mockResolvedValue([makeItem()]);
  api.listarEmpresas.mockResolvedValue([empresa]);
  api.listarPuertos.mockResolvedValue(puertos);
  api.crearItem.mockResolvedValue({});
  api.actualizarItem.mockResolvedValue({});
  api.eliminarItem.mockResolvedValue(null);
});

const campo = (re) => screen.getByLabelText(re);
const escribir = async (re, valor) => {
  const el = campo(re);
  await userEvent.clear(el);
  await userEvent.type(el, valor);
};
const enviar = (nombre) => userEvent.click(screen.getByRole("button", { name: nombre }));
const renderizar = async () => {
  render(<ItemsPage />);
  await screen.findByText("Contenedor 40' estándar", { selector: "td" });
};

async function completarAlta({ incoterm = "FOB" } = {}) {
  await userEvent.selectOptions(campo(/^Empresa/), "1");
  await userEvent.type(campo(/^Descripción/), "Contenedor 20'");
  await userEvent.selectOptions(campo(/^Origen/), "Shanghai");
  await userEvent.selectOptions(campo(/^Destino/), "Cartagena");
  await userEvent.type(campo(/^Costo base/), "1800");
  await userEvent.type(campo(/^Tránsito/), "30");
  await userEvent.selectOptions(campo(/^Frecuencia/), "quincenal");
  if (incoterm) await userEvent.selectOptions(campo(/^Incoterm/), incoterm);
}

describe("ItemsPage — listado", () => {
  it("muestra recargos, incoterm, tránsito y frecuencia; 'Sin dato' en ítems antiguos", async () => {
    api.listarItems.mockResolvedValue([makeItem(), makeLegacyItem({ descripcion: "Antiguo" })]);
    render(<ItemsPage />);
    const filaNueva = (await screen.findByText("Contenedor 40' estándar", { selector: "td" })).closest("tr");
    expect(within(filaNueva).getByText("BAF 4.0% · THC 3.0%")).toBeInTheDocument();
    expect(within(filaNueva).getByText("32 días")).toBeInTheDocument();
    const filaAntigua = screen.getByText("Antiguo").closest("tr");
    expect(within(filaAntigua).getByText("8.0% (consolidado)")).toBeInTheDocument();
    expect(within(filaAntigua).getAllByText("Sin dato").length).toBeGreaterThanOrEqual(2);
  });

  it("origen y destino se eligen del catálogo, con código cuando existe", async () => {
    await renderizar();
    const opciones = within(campo(/^Origen/)).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(expect.arrayContaining(["Shanghai (CNSHA)", "Cartagena (COCTG)", "Legacy"]));
  });
});

describe("ItemsPage — alta", () => {
  it("con desglose: el total es la suma, se bloquea el consolidado y se envían fracciones", async () => {
    await renderizar();
    await completarAlta();
    await userEvent.type(campo(/^BAF/), "4");
    await userEvent.type(campo(/^THC/), "3");

    expect(campo(/^Recargos consolidados/)).toBeDisabled();
    expect(campo(/^Recargos consolidados/)).toHaveValue(7);

    await enviar("Agregar ítem");
    expect(api.crearItem).toHaveBeenCalledWith({
      empresa_id: 1, tipo: "contenedor_maritimo", descripcion: "Contenedor 20'", origen: "Shanghai",
      destino: "Cartagena", unidad_tarifa: "por_contenedor", costo_base: 1800, impuestos_pct: 0,
      tipo_importacion: "importacion", vigencia_dias: 30, transito_dias: 30, frecuencia: "quincenal", incoterm: "FOB",
      recargos: [{ concepto: "baf", porcentaje: 0.04 }, { concepto: "thc", porcentaje: 0.03 }],
    });
    expect(api.actualizarItem).not.toHaveBeenCalled();
  });

  it("sin desglose: envía el consolidado como fracción y recargos vacíos", async () => {
    await renderizar();
    await completarAlta();
    await escribir(/^Recargos consolidados/, "8");
    await enviar("Agregar ítem");
    expect(api.crearItem).toHaveBeenCalledWith(expect.objectContaining({ impuestos_pct: 0.08, recargos: [] }));
  });

  it("un recargo en 0 cuenta como desglose (concepto aplicado con 0%)", async () => {
    await renderizar();
    await completarAlta();
    await userEvent.type(campo(/^BAF/), "0");
    await enviar("Agregar ítem");
    expect(api.crearItem).toHaveBeenCalledWith(
      expect.objectContaining({ impuestos_pct: 0, recargos: [{ concepto: "baf", porcentaje: 0 }] })
    );
  });

  it("no envía si falta el Incoterm (obligatorio, sin valor por defecto)", async () => {
    await renderizar();
    await completarAlta({ incoterm: null });
    await enviar("Agregar ítem");
    expect(api.crearItem).not.toHaveBeenCalled();
  });

  it("limpia el formulario y recarga tras crear", async () => {
    await renderizar();
    await completarAlta();
    await enviar("Agregar ítem");
    await vi.waitFor(() => expect(api.listarItems).toHaveBeenCalledTimes(2));
    expect(campo(/^Descripción/)).toHaveValue("");
    expect(campo(/^Incoterm/)).toHaveValue("");
  });

  it("muestra el error del backend y conserva lo escrito", async () => {
    api.crearItem.mockRejectedValue(new Error("El origen 'X' no está en el catálogo"));
    await renderizar();
    await completarAlta();
    await enviar("Agregar ítem");
    expect(await screen.findByText(/no está en el catálogo/)).toBeInTheDocument();
    expect(campo(/^Descripción/)).toHaveValue("Contenedor 20'");
  });
});

describe("ItemsPage — edición", () => {
  it("Editar carga el ítem en el formulario, con porcentajes sin ruido de coma flotante", async () => {
    api.listarItems.mockResolvedValue([makeItem({ recargos: [{ concepto: "baf", porcentaje: 0.07 }], impuestos_pct: 0.07 })]);
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("heading", { name: "Editando ítem #1" })).toBeInTheDocument();
    expect(campo(/^Empresa/)).toHaveValue("1");
    expect(campo(/^Origen/)).toHaveValue("Shanghai");
    expect(campo(/^Costo base/)).toHaveValue(2800);
    expect(campo(/^Tránsito/)).toHaveValue(32);
    expect(campo(/^Incoterm/)).toHaveValue("FOB");
    expect(campo(/^BAF/)).toHaveValue(7); // 0.07 * 100 = 7.000000000000001 sin redondeo
    expect(campo(/^THC/)).toHaveValue(null); // sin valor = no aplica
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("Guardar cambios llama a actualizarItem con el id y no crea", async () => {
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await escribir(/^Descripción/, "Modificada");
    await escribir(/^BAF/, "5");
    await enviar("Guardar cambios");

    expect(api.crearItem).not.toHaveBeenCalled();
    expect(api.actualizarItem).toHaveBeenCalledWith(1, expect.objectContaining({
      descripcion: "Modificada", impuestos_pct: 0, empresa_id: 1,
      recargos: [{ concepto: "baf", porcentaje: 0.05 }, { concepto: "thc", porcentaje: 0.03 }],
    }));
    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Ítems de costo" })).toBeInTheDocument());
  });

  it("quitar el desglose al editar vuelve al consolidado", async () => {
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.clear(campo(/^BAF/));
    await userEvent.clear(campo(/^THC/));
    expect(campo(/^Recargos consolidados/)).toBeEnabled();
    await escribir(/^Recargos consolidados/, "9");
    await enviar("Guardar cambios");
    expect(api.actualizarItem).toHaveBeenCalledWith(1, expect.objectContaining({ impuestos_pct: 0.09, recargos: [] }));
  });

  it("ítem antiguo: tránsito, frecuencia e Incoterm quedan vacíos y bloquean el guardado", async () => {
    api.listarItems.mockResolvedValue([makeLegacyItem()]);
    render(<ItemsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));

    expect(campo(/^Tránsito/)).toHaveValue(null);
    expect(campo(/^Frecuencia/)).toHaveValue("");
    expect(campo(/^Incoterm/)).toHaveValue("");
    expect(campo(/^Recargos consolidados/)).toHaveValue(8);

    await enviar("Guardar cambios");
    expect(api.actualizarItem).not.toHaveBeenCalled();

    await userEvent.type(campo(/^Tránsito/), "20");
    await userEvent.selectOptions(campo(/^Frecuencia/), "diaria");
    await userEvent.selectOptions(campo(/^Incoterm/), "CIF");
    await enviar("Guardar cambios");
    expect(api.actualizarItem).toHaveBeenCalledWith(99, expect.objectContaining({
      transito_dias: 20, frecuencia: "diaria", incoterm: "CIF", impuestos_pct: 0.08, recargos: [],
    }));
  });

  it("Cancelar edición restablece el formulario sin guardar", async () => {
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar edición" }));
    expect(screen.getByRole("heading", { name: "Ítems de costo" })).toBeInTheDocument();
    expect(campo(/^Descripción/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Agregar ítem" })).toBeInTheDocument();
    expect(api.actualizarItem).not.toHaveBeenCalled();
  });

  it("muestra el error del PUT y permanece en modo edición", async () => {
    api.actualizarItem.mockRejectedValue(new Error("impuestos_pct no coincide"));
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await enviar("Guardar cambios");
    expect(await screen.findByText("impuestos_pct no coincide")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editando ítem #1" })).toBeInTheDocument();
  });

  it("la fila en edición queda resaltada", async () => {
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByText("Contenedor 40' estándar", { selector: "td" }).closest("tr")).toHaveClass("selected");
  });
});

describe("ItemsPage — eliminar", () => {
  it("elimina y recarga", async () => {
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api.eliminarItem).toHaveBeenCalledWith(1);
    await vi.waitFor(() => expect(api.listarItems).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Ítem eliminado.")).toBeInTheDocument();
  });

  it("eliminar el ítem que se está editando sale del modo edición", async () => {
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Ítems de costo" })).toBeInTheDocument());
  });

  it("muestra el error si falla", async () => {
    api.eliminarItem.mockRejectedValue(new Error("no se pudo eliminar"));
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("no se pudo eliminar")).toBeInTheDocument();
  });
});

describe("ItemsPage — UX", () => {
  const otro = () => makeItem({ id: 2, descripcion: "Carga aérea general", origen: "Miami", destino: "Bogota",
    empresa: { id: 3, nombre: "Avianca", tipo: "aerolinea" }, recargos: [] });

  it("Cancelar la confirmación no elimina", async () => {
    await renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(api.eliminarItem).not.toHaveBeenCalled();
  });

  it("el buscador filtra por empresa, servicio o ruta y muestra el conteo", async () => {
    api.listarItems.mockResolvedValue([makeItem(), otro()]);
    await renderizar();
    expect(screen.getByText("(2)")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Buscar ítems"), "avianca");
    expect(screen.queryByText("Contenedor 40' estándar", { selector: "td" })).not.toBeInTheDocument();
    expect(screen.getByText("Carga aérea general", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("(1 de 2)")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Buscar ítems"));
    await userEvent.type(screen.getByLabelText("Buscar ítems"), "shanghai");
    expect(screen.getByText("Contenedor 40' estándar", { selector: "td" })).toBeInTheDocument();
  });

  it("sin coincidencias lo dice; sin ítems invita a crear el primero", async () => {
    await renderizar();
    await userEvent.type(screen.getByLabelText("Buscar ítems"), "zzz");
    expect(screen.getByText("Ningún ítem coincide con la búsqueda.")).toBeInTheDocument();

    api.listarItems.mockResolvedValue([]);
    cleanup();
    render(<ItemsPage />);
    expect(await screen.findByText(/Aún no hay ítems/)).toBeInTheDocument();
  });

  it("avisa al agregar y al actualizar", async () => {
    await renderizar();
    await completarAlta();
    await enviar("Agregar ítem");
    expect(await screen.findByRole("status")).toHaveTextContent("Ítem agregado.");

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await enviar("Guardar cambios");
    expect(await screen.findByRole("status")).toHaveTextContent("Ítem actualizado.");
  });

  it("agrupa el formulario en secciones", async () => {
    await renderizar();
    const secciones = screen.getAllByRole("group").map((g) => g.querySelector("legend")?.textContent);
    expect(secciones).toEqual(expect.arrayContaining(["Servicio", "Ruta", "Tarifa y vigencia", "Condiciones de la oferta", "Desglose de recargos (opcional)"]));
  });
});
