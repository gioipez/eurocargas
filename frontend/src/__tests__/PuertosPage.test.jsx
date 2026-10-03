import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import PuertosPage from "../pages/cargador/PuertosPage.jsx";
import { puertos } from "../test/fixtures.js";

vi.mock("../api.js");

beforeEach(() => {
  api.listarPuertos.mockResolvedValue(puertos);
});

const agregar = () => userEvent.click(screen.getByRole("button", { name: "Agregar puerto" }));

describe("PuertosPage", () => {
  it("lista puertos y marca los que no tienen código", async () => {
    render(<PuertosPage />);
    expect(await screen.findByText("COCTG")).toBeInTheDocument();
    expect(screen.getByText("Sin código")).toBeInTheDocument();
  });

  it("normaliza el código a mayúsculas y envía null en los opcionales vacíos", async () => {
    api.crearPuerto.mockResolvedValue({});
    render(<PuertosPage />);
    await screen.findByText("COCTG");
    await userEvent.type(screen.getByLabelText("Nombre"), "Rotterdam");
    await userEvent.type(screen.getByLabelText(/Código/), "nlrtm");
    await agregar();
    expect(api.crearPuerto).toHaveBeenCalledWith({ nombre: "Rotterdam", codigo: "NLRTM", pais: null });
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
  });

  it("código en blanco se envía como null", async () => {
    api.crearPuerto.mockResolvedValue({});
    render(<PuertosPage />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Miami");
    await userEvent.type(screen.getByLabelText(/Código/), "  ");
    await userEvent.type(screen.getByLabelText("País"), "EE.UU.");
    await agregar();
    expect(api.crearPuerto).toHaveBeenCalledWith({ nombre: "Miami", codigo: null, pais: "EE.UU." });
  });

  it("muestra el 409 del backend (duplicado) y conserva lo escrito", async () => {
    api.crearPuerto.mockRejectedValue(new Error("Ya existe el puerto 'Cartagena'"));
    render(<PuertosPage />);
    await userEvent.type(screen.getByLabelText("Nombre"), "cartagena");
    await agregar();
    expect(await screen.findByText("Ya existe el puerto 'Cartagena'")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("cartagena");
  });

  it("elimina y muestra el 409 cuando el puerto está en uso", async () => {
    api.eliminarPuerto.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("El puerto está en uso por 2 ítem(s)"));
    render(<PuertosPage />);
    const botones = await screen.findAllByRole("button", { name: "Eliminar" });
    await userEvent.click(botones[0]);
    expect(api.eliminarPuerto).toHaveBeenCalledWith(1);
    await userEvent.click(botones[1]);
    expect(await screen.findByText(/está en uso por 2/)).toBeInTheDocument();
  });
});
