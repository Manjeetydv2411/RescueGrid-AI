import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import QueryState from "../../src/components/common/QueryState";
import ErrorState from "../../src/components/common/ErrorState";
import EmptyState from "../../src/components/common/EmptyState";

describe("QueryState", () => {
  it("shows the loading state instead of the content", () => {
    render(
      <QueryState isLoading isError={false}>
        <p>Incident list</p>
      </QueryState>
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Incident list")).not.toBeInTheDocument();
  });

  it("shows the error state with a retry action when the request fails", () => {
    const onRetry = vi.fn();
    render(
      <QueryState
        isLoading={false}
        isError
        error={new Error("Network unreachable")}
        onRetry={onRetry}
      >
        <p>Incident list</p>
      </QueryState>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Network unreachable");
    expect(screen.queryByText("Incident list")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state when the query succeeded with no records", () => {
    render(
      <QueryState
        isLoading={false}
        isError={false}
        isEmpty
        emptyTitle="No incidents"
        emptyDescription="Nothing has been reported."
      >
        <p>Incident list</p>
      </QueryState>
    );

    expect(screen.getByText("No incidents")).toBeInTheDocument();
    expect(screen.getByText("Nothing has been reported.")).toBeInTheDocument();
    expect(screen.queryByText("Incident list")).not.toBeInTheDocument();
  });

  it("renders the children once the query succeeds", () => {
    render(
      <QueryState isLoading={false} isError={false} isEmpty={false}>
        <p>Incident list</p>
      </QueryState>
    );
    expect(screen.getByText("Incident list")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("announces itself as an alert", () => {
    render(<ErrorState title="Unable to load" message="Boom" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Unable to load");
    expect(alert).toHaveTextContent("Boom");
  });
});

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="No records" description="Try another filter." />);
    expect(screen.getByText("No records")).toBeInTheDocument();
    expect(screen.getByText("Try another filter.")).toBeInTheDocument();
  });
});
