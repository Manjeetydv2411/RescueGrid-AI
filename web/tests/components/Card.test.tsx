import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Card from "../../src/components/common/Card";

describe("Card Component", () => {
  it("renders card content", () => {
    render(<Card>Emergency Card Content</Card>);
    expect(screen.getByText("Emergency Card Content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="p-4 custom-class">Content</Card>);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
