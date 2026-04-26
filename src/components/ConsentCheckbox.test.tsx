import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConsentCheckbox } from "./ConsentCheckbox";

describe("ConsentCheckbox", () => {
  it("renders unchecked by default", () => {
    render(<ConsentCheckbox checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("renders checked when checked prop is true", () => {
    render(<ConsentCheckbox checked={true} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onChange(true) when toggled on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConsentCheckbox checked={false} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("links to /cgu and /confidentialite", () => {
    render(<ConsentCheckbox checked={false} onChange={() => {}} />);
    const cgu = screen.getByRole("link", { name: /cgu|conditions/i });
    const conf = screen.getByRole("link", { name: /confidentialité/i });
    expect(cgu).toHaveAttribute("href", "/cgu");
    expect(conf).toHaveAttribute("href", "/confidentialite");
  });

  it("renders an inline error when provided", () => {
    render(
      <ConsentCheckbox
        checked={false}
        onChange={() => {}}
        error="Vous devez accepter pour continuer"
      />,
    );
    expect(
      screen.getByText("Vous devez accepter pour continuer"),
    ).toBeInTheDocument();
  });
});
