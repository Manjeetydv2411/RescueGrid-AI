import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { allocationApi, getErrorMessage, type ResourceRecommendation } from "@/services/api";
import Button from "@/components/common/Button";

export const ResourceAllocationModal = ({
  incidentId,
  isOpen,
  onClose,
}: {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const recommendationsQuery = useQuery({
    queryKey: ["resource-recommendations", incidentId],
    queryFn: () => allocationApi.getRecommendations(incidentId),
    enabled: isOpen && Boolean(incidentId),
  });

  const allocateMutation = useMutation({
    mutationFn: () => allocationApi.allocate(incidentId, selectedResourceId!, notes),
    onSuccess: () => {
      toast.success("Resource successfully allocated!");
      void queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-xl bg-tactical-900 p-6 shadow-xl border border-platinum-200">
        <h2 className="text-xl font-bold text-platinum-900">Intelligent Resource Allocation</h2>
        <p className="mt-1 text-sm text-platinum-700">
          Select an AI-recommended resource optimized for distance, capability, and availability.
        </p>

        <div className="mt-4">
          {recommendationsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-platinum-700">Computing resource recommendations...</p>
          ) : recommendationsQuery.isError ? (
            <p className="text-sm text-alert-red">Failed to fetch resource recommendations.</p>
          ) : recommendationsQuery.data?.length === 0 ? (
            <p className="py-6 text-center text-sm text-platinum-700">No available resources found matching this incident.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {recommendationsQuery.data?.map((rec: ResourceRecommendation) => {
                const res = rec.resource;
                const isSelected = selectedResourceId === res._id;
                return (
                  <button
                    key={res._id}
                    type="button"
                    onClick={() => setSelectedResourceId(res._id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-cyber-cyan bg-cyber-cyan/10"
                        : "border-platinum-200 bg-white hover:border-platinum-300"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-platinum-900">{res.name}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-platinum-100 text-platinum-800">
                          {res.type}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600">
                        Score: {rec.matchScore}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-platinum-700">
                      Distance: {rec.distanceKm !== null ? `${rec.distanceKm} km` : "Unknown"} | Category: {res.category}
                    </p>
                    <p className="mt-1 text-xs italic text-platinum-600">{rec.explanation}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-platinum-900">
            Allocation Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-platinum-300 bg-white px-3 py-2 text-sm text-platinum-900"
              placeholder="Enter special instructions or staging point..."
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => allocateMutation.mutate()}
            disabled={!selectedResourceId || allocateMutation.isPending}
            isLoading={allocateMutation.isPending}
          >
            Allocate Resource
          </Button>
        </div>
      </div>
    </div>
  );
};
