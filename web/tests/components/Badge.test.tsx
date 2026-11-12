import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "../../src/components/common/Badge";

describe("Badge Component", () => {
  it("renders children correctly", () => {
    render(<Badge>Active Incident</Badge>);
    expect(screen.getByText("Active Incident")).toBeInTheDocument();
  });

  it("applies blue style by default", () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass("text-cyber-cyan");
  });

  it("applies red style for critical severity", () => {
    const { container } = render(<Badge color="red">Critical</Badge>);
    expect(container.firstChild).toHaveClass("text-alert-red");
  });

  it("applies green style for resolved status", () => {
    const { container } = render(<Badge color="green">Resolved</Badge>);
    expect(container.firstChild).toHaveClass("text-safe-green");
  });
});
