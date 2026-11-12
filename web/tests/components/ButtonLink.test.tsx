import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

import { ButtonLink } from "../../src/components/common/Button";

const renderLink = (ui: ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("ButtonLink", () => {
  it("renders an anchor, not a nested button", () => {
    renderLink(<ButtonLink to="/incidents">Browse incidents</ButtonLink>);

    const link = screen.getByRole("link", { name: /browse incidents/i });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/incidents");

    // A <button> inside an <a> is invalid HTML and produces a second tab stop.
    expect(
      screen.queryByRole("button", { name: /browse incidents/i })
    ).not.toBeInTheDocument();
    expect(link.querySelector("button")).toBeNull();
  });

  it("applies the same button styling as Button", () => {
    renderLink(
      <ButtonLink to="/map" variant="secondary" size="sm">
        Open live map
      </ButtonLink>
    );

    const link = screen.getByRole("link", { name: /open live map/i });
    expect(link.className).toContain("inline-flex");
    expect(link.className).toContain("focus-visible:ring-cyber-cyan");
    expect(link.className).toContain("px-2.5");
  });

  it("renders a full-width link when asked", () => {
    renderLink(
      <ButtonLink to="/incidents/i1" fullWidth>
        Open incident
      </ButtonLink>
    );

    expect(screen.getByRole("link").className).toContain("w-full");
  });
});
