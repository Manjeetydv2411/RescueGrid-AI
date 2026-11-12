import { useState, useEffect, useCallback, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import type { TourDefinition, TourStep } from "./tourSteps";

interface GuidedTourProps {
  tour: TourDefinition;
  onClose: () => void;
}

export const GuidedTour = ({ tour, onClose }: GuidedTourProps) => {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [, startTransition] = useTransition();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetNotFound, setTargetNotFound] = useState(false);

  const currentStep: TourStep = tour.steps[currentStepIndex];

  const updateTargetPosition = useCallback(() => {
    if (!currentStep) return;
    const element = document.querySelector(currentStep.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      setTargetNotFound(false);
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "center",
      });
    } else {
      setTargetRect(null);
      setTargetNotFound(true);
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep?.route) {
      startTransition(() => {
        navigate(currentStep.route!);
      });
    }
  }, [currentStep, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(updateTargetPosition, 250);
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition, true);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition, true);
    };
  }, [updateTargetPosition, currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < tour.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handleBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStepIndex, tour.steps.length]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Guided Tour: ${tour.title}`}
      className="fixed inset-0 z-[1000] overflow-hidden pointer-events-none"
    >
      {/* Backdrop with cutout or overlay */}
      <div className="absolute inset-0 bg-tactical-950/75 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300" />

      {/* Spotlight highlight box over target element */}
      {targetRect && (
        <div
          className="absolute rounded-lg border-2 border-cyber-cyan shadow-neon-cyan transition-all duration-300 pointer-events-none z-[1005]"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tooltip Card */}
      <div className="absolute z-[1010] pointer-events-auto bottom-8 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-auto sm:right-8 w-[92%] sm:w-[420px] rounded-xl border border-cyber-cyan/40 bg-[#111827] p-5 shadow-glass font-sans text-white">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-3 mb-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-cyber-cyan font-bold">
              {tour.title}
            </span>
            <h4 className="text-sm font-bold text-platinum-900 mt-0.5">
              {currentStep.title}
            </h4>
          </div>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30">
            Step {currentStepIndex + 1} of {tour.steps.length}
          </span>
        </div>

        <p className="text-xs text-platinum-800 leading-relaxed mb-4">
          {currentStep.content}
        </p>

        {targetNotFound && (
          <div className="mb-3 rounded bg-warn-amber/10 border border-warn-amber/30 px-3 py-2 text-[11px] text-warn-amber font-mono">
            Target element is currently hidden or off-screen. You can proceed to the next step.
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[#1F2937]">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-platinum-700 hover:text-white transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg bg-[#1F2937] px-3 py-1.5 text-xs font-mono font-semibold text-white hover:bg-[#374151] transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg bg-cyber-cyan px-4 py-1.5 text-xs font-mono font-bold text-tactical-950 hover:bg-cyber-cyan/90 transition-colors shadow-neon-cyan"
            >
              {currentStepIndex === tour.steps.length - 1 ? "Finish" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
