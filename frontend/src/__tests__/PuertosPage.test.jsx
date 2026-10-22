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
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api.eliminarPuerto).toHaveBeenCalledWith(1);
    expect(await screen.findByText("Puerto eliminado.")).toBeInTheDocument();
    await userEvent.click(botones[1]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText(/está en uso por 2/)).toBeInTheDocument();
  });
});

describe("PuertosPage — UX", () => {
  it("avisa al crear y muestra el estado vacío cuando no hay puertos", async () => {
    api.listarPuertos.mockResolvedValue([]);
    api.crearPuerto.mockResolvedValue({});
    render(<PuertosPage />);
    expect(await screen.findByText("Aún no hay puertos en el catálogo.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nombre"), " Miami ");
    await userEvent.click(screen.getByRole("button", { name: "Agregar puerto" }));
    expect(await screen.findByRole("status")).toHaveTextContent('Puerto "Miami" agregado.');
  });

  it("Cancelar la confirmación no elimina", async () => {
    render(<PuertosPage />);
    const botones = await screen.findAllByRole("button", { name: "Eliminar" });
    await userEvent.click(botones[0]);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(api.eliminarPuerto).not.toHaveBeenCalled();
  });
});

describe("PuertosPage — validación", () => {
  it("el código se normaliza mientras se escribe (mayúsculas, sin espacios)", async () => {
    render(<PuertosPage />);
    await userEvent.type(screen.getByLabelText(/Código/), "co ctg");
    expect(screen.getByLabelText(/Código/)).toHaveValue("COCTG");
  });

  it("un código de 4 caracteres se rechaza en línea sin llamar a la API", async () => {
    render(<PuertosPage />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Rotterdam");
    await userEvent.type(screen.getByLabelText(/Código/), "nlrt");
    await agregar();
    const codigo = screen.getByLabelText(/Código/);
    expect(codigo).toHaveAttribute("aria-invalid", "true");
    expect(codigo).toHaveFocus();
    expect(codigo).toHaveAccessibleDescription(expect.stringContaining("Usa 3 letras (IATA) o 5 caracteres (UN/LOCODE)."));
    expect(api.crearPuerto).not.toHaveBeenCalled();
  });

  it("la ayuda del código va fuera de la etiqueta y enlazada con aria-describedby", async () => {
    render(<PuertosPage />);
    const codigo = screen.getByLabelText("Código (UN/LOCODE o IATA)");
    expect(codigo).toHaveAccessibleDescription(expect.stringContaining("3 letras (IATA, p. ej. BOG)"));
  });

  it("un 422 con error por campo se muestra junto al campo", async () => {
    const error = Object.assign(new Error("Código: el formato no es válido."), { campos: { codigo: "El formato no es válido." } });
    api.crearPuerto.mockRejectedValue(error);
    render(<PuertosPage />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Bogotá");
    await userEvent.type(screen.getByLabelText(/Código/), "BOG");
    await agregar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Código: el formato no es válido.");
    expect(screen.getByLabelText(/Código/)).toHaveAttribute("aria-invalid", "true");
  });

  it("si falla la carga no muestra el estado vacío", async () => {
    api.listarPuertos.mockRejectedValue(new Error("sin conexión"));
    render(<PuertosPage />);
    await screen.findByRole("alert");
    expect(screen.queryByText("Aún no hay puertos en el catálogo.")).not.toBeInTheDocument();
  });
});
