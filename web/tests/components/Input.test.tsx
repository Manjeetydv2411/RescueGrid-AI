import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Input from "../../src/components/common/Input";

describe("Input Component", () => {
  it("renders with label", () => {
    render(<Input label="Incident Title" placeholder="Enter title" />);
    expect(screen.getByText("Incident Title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter title")).toBeInTheDocument();
  });

  it("displays error message when provided", () => {
    render(<Input label="Incident Title" error="Title is required" />);
    expect(screen.getByText("Title is required")).toBeInTheDocument();
  });
});
