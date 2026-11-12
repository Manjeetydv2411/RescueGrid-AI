import { useState, useEffect, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { z } from "zod";

import { getErrorMessage, resourceApi } from "../../services/api";
import { RESOURCE_STATUSES, getResourceStatusMeta } from "../../utils/domain";
import type { Resource, ResourceStatus } from "../../types/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import LocationPicker from "../../components/common/LocationPicker";

const RESOURCE_TYPE_SUGGESTIONS = [
  "AMBULANCE",
  "MEDICAL_TEAM",
  "RESCUE_TEAM",
  "SHELTER",
  "FIRE_UNIT",
  "SUPPLY_DEPOT",
  "EQUIPMENT",
  "Vehicle",
  "Medical",
  "Water rescue unit",
  "Pumping equipment",
  "Aerial survey",
];

const RESOURCE_CATEGORY_SUGGESTIONS = [
  "Rescue",
  "Transport",
  "Medical",
  "Equipment",
];

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Resource name must be at least 2 characters"),
  type: z.string().trim().min(2, "Resource type must be at least 2 characters"),
  category: z.string().trim().min(2, "Category must be at least 2 characters"),
  status: z.enum(["AVAILABLE", "ON_MISSION", "MAINTENANCE", "UNAVAILABLE"]),
  address: z.string().optional(),
  latitude: z
    .number({ invalid_type_error: "Latitude must be a number" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number({ invalid_type_error: "Longitude must be a number" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  capacity: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d+$/.test(value),
      "Capacity must be a positive integer"
    )
    .refine(
      (value) => value === "" || Number(value) > 0,
      "Capacity must be a positive integer"
    ),
  contact: z.string().trim().max(200, "Contact must be 200 characters or fewer"),
});

type FormData = z.infer<typeof formSchema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

type ResourcePayload = {
  name: string;
  type: string;
  category: string;
  status: ResourceStatus;
  location: { type: "Point"; coordinates: [number, number] };
  address?: string;
  capacity?: number;
  contact?: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  type: "",
  category: "",
  status: "AVAILABLE",
  address: "",
  latitude: 37.7749,
  longitude: -122.4194,
  capacity: "",
  contact: "",
};

interface ResourceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource?: Resource | null;
}

const ResourceCreateModal = ({ isOpen, onClose, resource }: ResourceCreateModalProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(resource);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (resource) {
      setFormData({
        name: resource.name,
        type: resource.type,
        category: resource.category,
        status: resource.status,
        address: resource.address ?? "",
        latitude: resource.location?.coordinates[1] ?? 37.7749,
        longitude: resource.location?.coordinates[0] ?? -122.4194,
        capacity: resource.capacity !== undefined ? String(resource.capacity) : "",
        contact: resource.contact ?? "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setErrors({});
    setApiError("");
  }, [resource, isOpen]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setApiError("");
  };

  const mutation = useMutation({
    mutationFn: (payload: ResourcePayload) =>
      isEdit && resource
        ? resourceApi.update(resource._id, payload)
        : resourceApi.create(payload),
    onSuccess: (updatedOrCreated) => {
      toast.success(
        isEdit
          ? `${updatedOrCreated.name} updated successfully`
          : `${updatedOrCreated.name} added to the resource inventory`
      );
      resetForm();
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      setApiError(
        getErrorMessage(
          error,
          isEdit ? "Unable to update the resource" : "Unable to add the resource"
        )
      );
    },
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    resetForm();
    onClose();
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setApiError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutation.isPending) return;
    setApiError("");

    const parsed = formSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormData | undefined;
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const data = parsed.data;
    const payload: ResourcePayload = {
      name: data.name,
      type: data.type,
      category: data.category,
      status: data.status,
      location: {
        type: "Point",
        coordinates: [data.longitude, data.latitude],
      },
      ...(data.address ? { address: data.address } : {}),
      ...(data.capacity ? { capacity: Number(data.capacity) } : {}),
      ...(data.contact ? { contact: data.contact } : {}),
    };

    mutation.mutate(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? "Edit resource" : "Add resource"}
      description={
        isEdit
          ? "Update the operational parameters of this response asset."
          : "Register a response asset in the operational inventory."
      }
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="resource-create-form"
            isLoading={mutation.isPending}
          >
            {isEdit ? "Save changes" : "Add resource"}
          </Button>
        </>
      }
    >
      <form
        id="resource-create-form"
        className="space-y-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Resource name"
            placeholder="e.g. Northside rescue boat"
            value={formData.name}
            onChange={(event) => updateField("name", event.target.value)}
            error={errors.name}
            required
            autoComplete="off"
          />
          <Input
            label="Resource type"
            placeholder="e.g. Vehicle or MEDICAL_TEAM"
            list="resource-type-suggestions"
            value={formData.type}
            onChange={(event) => updateField("type", event.target.value)}
            error={errors.type}
            hint="Free text; suggestions use the existing resource vocabulary."
            required
            autoComplete="off"
          />
        </div>

        <datalist id="resource-type-suggestions">
          {RESOURCE_TYPE_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>

        <Input
          label="Category"
          placeholder="e.g. Rescue, Medical, or Equipment"
          list="resource-category-suggestions"
          value={formData.category}
          onChange={(event) => updateField("category", event.target.value)}
          error={errors.category}
          hint="Categories are intentionally free text to match existing records."
          required
          autoComplete="off"
        />

        <datalist id="resource-category-suggestions">
          {RESOURCE_CATEGORY_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>

        <Select
          label="Availability status"
          value={formData.status}
          onChange={(event) =>
            updateField("status", event.target.value as FormData["status"])
          }
          error={errors.status}
          hint={getResourceStatusMeta(formData.status).description}
          required
        >
          {RESOURCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {getResourceStatusMeta(status).label}
            </option>
          ))}
        </Select>

        <LocationPicker
          latitude={formData.latitude}
          longitude={formData.longitude}
          address={formData.address || ""}
          onLocationChange={(address, latitude, longitude) => {
            setFormData((current) => ({
              ...current,
              address,
              latitude,
              longitude,
            }));
            setErrors((current) => {
              const next = { ...current };
              delete next.latitude;
              delete next.longitude;
              delete next.address;
              return next;
            });
          }}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Capacity"
            type="number"
            min={1}
            step={1}
            placeholder="Optional"
            value={formData.capacity}
            onChange={(event) => updateField("capacity", event.target.value)}
            error={errors.capacity}
            hint="Optional positive whole number"
          />
          <Input
            label="Contact"
            placeholder="Phone, radio channel, or email"
            value={formData.contact}
            onChange={(event) => updateField("contact", event.target.value)}
            error={errors.contact}
            hint="Optional; maximum 200 characters"
            autoComplete="off"
          />
        </div>

        {apiError && (
          <div
            role="alert"
            className="rounded-lg border border-alert-red/40 bg-alert-red/10 px-4 py-3 text-sm text-alert-red"
          >
            {apiError}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ResourceCreateModal;
