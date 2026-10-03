import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmButton from "../components/ConfirmButton.jsx";

describe("ConfirmButton", () => {
  it("el primer clic solo pide confirmación; no ejecuta la acción", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} mensaje="¿Eliminar ítem?" />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("¿Eliminar ítem?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });

  it("Confirmar ejecuta la acción una vez y vuelve al estado inicial", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  it("Cancelar vuelve al estado inicial sin ejecutar", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  it("acepta un texto de botón propio", () => {
    render(<ConfirmButton onConfirm={() => {}}>Quitar</ConfirmButton>);
    expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
  });
});
