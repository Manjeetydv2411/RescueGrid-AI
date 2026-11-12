import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import useClampPage from "../../src/hooks/useClampPage";

describe("useClampPage", () => {
  it("does nothing while the served page is within range", () => {
    const onClamp = vi.fn();
    const { result } = renderHook(() =>
      useClampPage({ page: 2, totalPages: 5 }, onClamp)
    );

    expect(onClamp).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  it("asks for the last available page when the served page is past the end", async () => {
    const onClamp = vi.fn();
    const { result } = renderHook(() =>
      useClampPage({ page: 5, totalPages: 2 }, onClamp)
    );

    await waitFor(() => {
      expect(onClamp).toHaveBeenCalledWith(2);
    });
    expect(result.current).toBe(true);
  });

  it("asks for the first page when the result set is empty", async () => {
    const onClamp = vi.fn();
    renderHook(() => useClampPage({ page: 3, totalPages: 0 }, onClamp));

    await waitFor(() => {
      expect(onClamp).toHaveBeenCalledWith(1);
    });
  });

  it("does not ask for the same correction twice", async () => {
    const onClamp = vi.fn();
    const { rerender } = renderHook(
      ({ page, totalPages }: { page: number; totalPages: number }) =>
        useClampPage({ page, totalPages }, onClamp),
      { initialProps: { page: 5, totalPages: 2 } }
    );

    await waitFor(() => {
      expect(onClamp).toHaveBeenCalledTimes(1);
    });

    // A background refresh of the same out-of-range page must not push the
    // URL around again.
    rerender({ page: 5, totalPages: 2 });
    expect(onClamp).toHaveBeenCalledTimes(1);
  });

  it("stays true until the corrected page has been served", async () => {
    const onClamp = vi.fn();
    const { result, rerender } = renderHook(
      ({ page, totalPages }: { page: number; totalPages: number }) =>
        useClampPage({ page, totalPages }, onClamp),
      { initialProps: { page: 5, totalPages: 2 } }
    );

    await waitFor(() => {
      expect(onClamp).toHaveBeenCalledWith(2);
    });
    expect(result.current).toBe(true);

    // The corrected page arrives: the adjustment is complete.
    rerender({ page: 2, totalPages: 2 });
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("does nothing before the first response arrives", () => {
    const onClamp = vi.fn();
    const { result } = renderHook(() => useClampPage(undefined, onClamp));

    expect(onClamp).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  it("ignores a callback that changes identity between renders", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onClamp }: { onClamp: (page: number) => void }) =>
        useClampPage({ page: 5, totalPages: 2 }, onClamp),
      { initialProps: { onClamp: first } }
    );

    await waitFor(() => {
      expect(first).toHaveBeenCalledWith(2);
    });

    rerender({ onClamp: second });
    expect(second).not.toHaveBeenCalled();
  });
});
