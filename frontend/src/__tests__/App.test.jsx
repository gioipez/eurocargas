import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import App from "../App.jsx";
import { makeItem, puertos } from "../test/fixtures.js";

vi.mock("../api.js");

beforeEach(() => {
  window.history.replaceState(null, "", "/"); // el hash (rol/pestaña) persiste entre tests en jsdom
  api.listarEmpresas.mockResolvedValue([]);
  api.listarItems.mockResolvedValue([]);
  api.listarPuertos.mockResolvedValue(puertos);
  api.obtenerConfig.mockResolvedValue({ tasa_cambio_usd_cop: 4000 });
});

describe("App", () => {
  it("empieza en el selector de rol", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Soy Cargador/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Soy Comercial/ })).toBeInTheDocument();
  });

  it("Comercial abre el wizard y 'Cambiar rol' vuelve al selector", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Soy Comercial/ }));
    expect(await screen.findByText("Wizard de cotización")).toBeInTheDocument();
    expect(screen.getByText(/Cotizador \(Comercial\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar rol" }));
    expect(screen.getByRole("button", { name: /Soy Cargador/ })).toBeInTheDocument();
  });

  it("Cargador navega por todas las pestañas", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Soy Cargador/ }));
    expect(await screen.findByRole("heading", { name: "Empresas proveedoras" })).toBeInTheDocument();

    const pestañas = [
      ["Puertos", "Puertos y aeropuertos"],
      ["Ítems / Tarifas", "Ítems de costo"],
      ["Configuración", "Configuración global"],
      ["Empresas", "Empresas proveedoras"],
    ];
    for (const [pestaña, titulo] of pestañas) {
      await userEvent.click(screen.getByRole("button", { name: pestaña }));
      expect(await screen.findByRole("heading", { name: titulo })).toBeInTheDocument();
    }
  });

  it("los tabs del cargador quedan en el hash", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Soy Cargador/ }));
    expect(window.location.hash).toBe("#/cargador/empresas");
    await userEvent.click(screen.getByRole("button", { name: "Ítems / Tarifas" }));
    expect(window.location.hash).toBe("#/cargador/items");
    expect(screen.getByRole("button", { name: "Ítems / Tarifas" })).toHaveAttribute("aria-current", "page");
  });
});

describe("App — rutas por hash", () => {
  const irA = async (hash) => {
    await act(async () => {
      window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  };

  it("abre directamente la pestaña indicada en el hash", async () => {
    window.location.hash = "#/cargador/items";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Ítems de costo" })).toBeInTheDocument();
  });

  it("#/comercial abre el wizard", async () => {
    window.location.hash = "#/comercial";
    render(<App />);
    expect(await screen.findByText("Wizard de cotización")).toBeInTheDocument();
  });

  it("un hash desconocido vuelve al selector de rol", () => {
    window.location.hash = "#/cualquier/cosa";
    render(<App />);
    expect(screen.getByRole("button", { name: /Soy Cargador/ })).toBeInTheDocument();
  });

  it("atrás/adelante (hashchange) cambia de pantalla", async () => {
    render(<App />);
    await irA("#/cargador/puertos");
    expect(await screen.findByRole("heading", { name: "Puertos y aeropuertos" })).toBeInTheDocument();
    await irA("#/cargador/config");
    expect(await screen.findByRole("heading", { name: "Configuración global" })).toBeInTheDocument();
    await irA("#/");
    expect(screen.getByRole("button", { name: /Soy Comercial/ })).toBeInTheDocument();
  });
});

describe("App — cambiar de rol con una cotización en curso", () => {
  async function wizardConDatos() {
    api.listarItems.mockResolvedValue([makeItem()]);
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Soy Comercial/ }));
    await screen.findByRole("option", { name: "Shanghai" });
    await userEvent.selectOptions(screen.getByLabelText(/1\. Origen/), "Shanghai");
  }

  it("pide confirmación en línea; 'Seguir cotizando' conserva el wizard", async () => {
    await wizardConDatos();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar rol" }));
    expect(screen.getByText(/Hay una cotización en curso/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seguir cotizando" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Seguir cotizando" }));
    expect(screen.getByLabelText(/1\. Origen/)).toHaveValue("Shanghai");
    expect(screen.getByRole("button", { name: "Cambiar rol" })).toHaveFocus();
  });

  it("'Descartar y cambiar' vuelve al selector de rol", async () => {
    await wizardConDatos();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar rol" }));
    await userEvent.click(screen.getByRole("button", { name: "Descartar y cambiar" }));
    expect(screen.getByRole("button", { name: /Soy Cargador/ })).toBeInTheDocument();
  });

  it("Escape cancela la confirmación", async () => {
    await wizardConDatos();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar rol" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText(/Hay una cotización en curso/)).not.toBeInTheDocument();
    expect(screen.getByText("Wizard de cotización")).toBeInTheDocument();
  });
});
