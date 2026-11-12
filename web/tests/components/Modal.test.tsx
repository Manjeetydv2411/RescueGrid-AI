import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";

import Modal from "../../src/components/common/Modal";

/**
 * A harness that re-renders the modal's parent on every keystroke, the way a
 * real form does. The parent passes an inline arrow for `onClose`, so its
 * identity changes on every render.
 */
const Harness = () => {
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState("");

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Dispatch a responder"
        description="Choose an on-duty responder."
      >
        <input
          aria-label="Dispatch notes"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Modal>
    </div>
  );
};

describe("Modal Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a labelled dialog", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Dispatch a responder">
        <p>Body</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("heading", { name: "Dispatch a responder" })
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        <p>Body</p>
      </Modal>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps focus in the field while typing", () => {
    // The parent re-renders on every keystroke, which gives `onClose` a new
    // identity. If the focus effect depended on it, each keystroke would tear
    // the effect down and its cleanup would restore focus to the trigger,
    // yanking it out of the field mid-word.
    render(<Harness />);

    // The modal moves focus into the dialog on open, via a zero-delay timer.
    act(() => {
      vi.runOnlyPendingTimers();
    });

    const field = screen.getByLabelText("Dispatch notes");
    field.focus();
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: "Bring the ladder" } });

    expect(screen.getByLabelText("Dispatch notes")).toHaveFocus();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Dispatch a responder">
        <p>Body</p>
      </Modal>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
