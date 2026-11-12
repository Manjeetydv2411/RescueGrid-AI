
import {
  useEffect,
  useState,
  type FormEvent,
  useRef,
  type ChangeEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { z } from "zod";

import { aiApi, getErrorMessage, incidentApi } from "../../services/api";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_STATUS_TRANSITIONS,
  getCategoryMeta,
  getSeverityMeta,
} from "../../utils/domain";
import type {
  IncidentCategory,
  IncidentStatus,
  Severity,
} from "../../types/api";

import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Input from "../../components/common/Input";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import Textarea from "../../components/common/Textarea";
import LocationPicker from "../../components/common/LocationPicker";
import { phone } from "../../utils/phone";
import INCIDENT_PHONE_VALIDATION_MESSAGES from "../../utils/incidentPhoneValidationMessages";
import { VoiceIncidentReporter } from "../../components/VoiceIncidentReporter";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  category: z.enum([
    "FLOOD",
    "FIRE",
    "EARTHQUAKE",
    "LANDSLIDE",
    "MEDICAL",
    "OTHER",
  ]),
  address: z.string().optional(),
  latitude: z
    .number({ invalid_type_error: "Latitude must be a number" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number({ invalid_type_error: "Longitude must be a number" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  contactPhone: z.string().trim(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  severity: "MEDIUM",
  category: "OTHER",
  address: "",
  latitude: 28.6139,
  longitude: 77.209,
  contactPhone: "",
  tags: "",
};

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const IncidentForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [status, setStatus] = useState<IncidentStatus | "">("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const incidentQuery = useQuery({
    queryKey: ["incident", id],
    queryFn: () => incidentApi.get(id!),
    enabled: isEdit,
  });

  // Populate the form when editing an existing incident.
  useEffect(() => {
    const incident = incidentQuery.data;
    if (!incident) return;

    setFormData({
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      category: incident.category,
      address: incident.address ?? "",
      latitude: incident.location?.coordinates[1] ?? EMPTY_FORM.latitude,
      longitude: incident.location?.coordinates[0] ?? EMPTY_FORM.longitude,
      contactPhone: incident.contactPhone ?? "",
      tags: (incident.tags ?? []).join(", "),
    });
  }, [incidentQuery.data]);

  // Clean up generated preview URLs.
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));

      if (videoPreview) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, [imagePreviews, videoPreview]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (images.length + files.length > MAX_IMAGE_COUNT) {
      toast.error(`Maximum ${MAX_IMAGE_COUNT} images allowed`);
      event.target.value = "";
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image`);
        return false;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`Image ${file.name} exceeds 5MB limit`);
        return false;
      }

      return true;
    });

    setImages((previous) => [...previous, ...validFiles]);

    setImagePreviews((previous) => [
      ...previous,
      ...validFiles.map((file) => URL.createObjectURL(file)),
    ]);

    event.target.value = "";
  };

  const removeImage = (index: number) => {
    const preview = imagePreviews[index];

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setImages((previous) => previous.filter((_, i) => i !== index));
    setImagePreviews((previous) => previous.filter((_, i) => i !== index));
  };

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    if (file && !file.type.startsWith("video/")) {
      toast.error("Please select a valid video file");
      event.target.value = "";
      return;
    }

    if (file && file.size > MAX_VIDEO_SIZE) {
      toast.error("Video exceeds 50MB limit");
      event.target.value = "";
      return;
    }

    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideo(file);
    setVideoPreview(file ? URL.createObjectURL(file) : null);

    event.target.value = "";
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideo(null);
    setVideoPreview(null);
  };

  // AI-powered category suggestion.
  const categorySuggestion = useMutation({
    mutationFn: () =>
      aiApi.categorySuggestion({
        title: formData.title,
        description: formData.description,
      }),

    onSuccess: (result) => {
      const category = result.suggested_category as IncidentCategory;

      setFormData((previous) => ({
        ...previous,
        category,
      }));

      toast.success(
        `AI Category suggestion: ${getCategoryMeta(category).label}. Review before saving.`
      );
    },

    onError: (error) => {
      toast.error(
        getErrorMessage(error, "AI category suggestion service is offline.")
      );
    },
  });

  // Save using separate create and update API paths.
  const saveMutation = useMutation({
    mutationFn: async () => {
      let normalizedPhone: string | undefined;
      const enteredPhone = formData.contactPhone.trim();

      if (enteredPhone) {
        const result = phone.normalizePhoneNumber(enteredPhone);

        if (!result.isValid) {
          const message =
            result.error || INCIDENT_PHONE_VALIDATION_MESSAGES.INVALID;

          setErrors((previous) => ({
            ...previous,
            contactPhone: message,
          }));

          throw new Error(message);
        }

        normalizedPhone = result.normalized;
      } else if (!isEdit) {
        const message = INCIDENT_PHONE_VALIDATION_MESSAGES.REQUIRED;

        setErrors((previous) => ({
          ...previous,
          contactPhone: message,
        }));

        throw new Error(message);
      }

      const tags = (formData.tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      if (isEdit) {
        const payload: Record<string, unknown> = {
          title: formData.title,
          description: formData.description,
          severity: formData.severity,
          category: formData.category,
          location: {
            type: "Point",
            coordinates: [formData.longitude, formData.latitude],
          },
          address: formData.address || undefined,
          tags,
        };

        // Preserve an existing legacy phone if no new phone was entered.
        if (normalizedPhone) {
          payload.contactPhone = normalizedPhone;
        }

        if (status) {
          payload.status = status;
        }

        return incidentApi.update(id!, payload);
      }

      const fd = new FormData();

      fd.append("title", formData.title);
      fd.append("description", formData.description);
      fd.append("severity", formData.severity);
      fd.append("category", formData.category);

      fd.append(
        "location",
        JSON.stringify({
          type: "Point",
          coordinates: [formData.longitude, formData.latitude],
        })
      );

      if (formData.address) {
        fd.append("address", formData.address);
      }

      if (tags.length) {
        fd.append("tags", JSON.stringify(tags));
      }

      fd.append("contactPhone", normalizedPhone!);

      images.forEach((image) => fd.append("images", image));

      if (video) {
        fd.append("video", video);
      }

      return incidentApi.create(fd);
    },

    onSuccess: (incident) => {
      toast.success(
        isEdit
          ? "Incident record updated"
          : `Emergency reported: ${incident.title}`
      );

      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["incident", id] });

      navigate(`/incidents/${incident._id}`);
    },

    onError: (error) => {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to save the incident record"
      );
    },
  });

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrors((previous) => {
      if (!previous[field as string]) {
        return previous;
      }

      const next = { ...previous };
      delete next[field as string];

      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");

    const parsed = formSchema.safeParse(formData);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};

      parsed.error.errors.forEach((issue) => {
        const field = issue.path[0];

        if (field && !fieldErrors[String(field)]) {
          fieldErrors[String(field)] = issue.message;
        }
      });

      setErrors(fieldErrors);
      return;
    }

    if (!isEdit && !formData.contactPhone.trim()) {
      setErrors({
        contactPhone: INCIDENT_PHONE_VALIDATION_MESSAGES.REQUIRED,
      });
      return;
    }

    const requireImage =
      import.meta.env.VITE_REQUIRE_INCIDENT_IMAGE === "true";

    if (!isEdit && requireImage && images.length === 0) {
      setApiError(
        "At least one image is required for new incident reports"
      );
      return;
    }

    setErrors({});
    saveMutation.mutate();
  };

const allowedStatuses = incidentQuery.data
  ? (INCIDENT_STATUS_TRANSITIONS[incidentQuery.data.status] ?? []).filter(
      (nextStatus) => nextStatus !== incidentQuery.data!.status
    )
  : [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(-1)}
        >
          ← Back
        </Button>

        <div className="mt-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />

          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
            INCIDENTS // {isEdit ? "MODIFY RECORD" : "NEW SOS REPORT"}
          </p>
        </div>

        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          {isEdit ? "Edit Emergency Incident" : "Report Emergency Incident"}
        </h1>
      </div>

      <QueryState
        isLoading={isEdit && incidentQuery.isLoading}
        isError={isEdit && incidentQuery.isError}
        error={incidentQuery.error}
        onRetry={() => void incidentQuery.refetch()}
      >
        {!isEdit && (
          <VoiceIncidentReporter
            onTranscriptionApplied={(data) => {
              setFormData((prev) => ({
                ...prev,
                title: data.title || prev.title,
                description: data.description || prev.description,
                severity: data.severity || prev.severity,
                category: data.category || prev.category,
                address: data.address || prev.address,
                latitude: data.location?.coordinates[1] ?? prev.latitude,
                longitude: data.location?.coordinates[0] ?? prev.longitude,
                contactPhone: data.contactPhone || prev.contactPhone,
                tags: data.tags || prev.tags,
              }));
            }}
          />
        )}

        <Card>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="Title"
              placeholder="Short, specific summary of emergency"
              value={formData.title}
              onChange={(event) =>
                updateField("title", event.target.value)
              }
              error={errors.title}
              required
            />

            <Textarea
              label="Description"
              rows={5}
              placeholder="What happened, hazards involved, units required."
              value={formData.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              error={errors.description}
              required
            />

            <Input
              label="Reporter Phone Number"
              placeholder="Enter a contact number"
              value={formData.contactPhone}
              onChange={(event) =>
                updateField("contactPhone", event.target.value)
              }
              error={errors.contactPhone}
              required={!isEdit}
            />

            <Input
              label="Tags"
              placeholder="e.g. flooding, evacuation, urgent"
              value={formData.tags ?? ""}
              onChange={(event) =>
                updateField("tags", event.target.value)
              }
              error={errors.tags}
              hint="Separate multiple tags with commas."
            />

            <Input
  label="Address"
  value={formData.address}
  onChange={(event) => updateField("address", event.target.value)}
  placeholder="Enter the incident address"
/>

            <LocationPicker
              key={`${formData.latitude}-${formData.longitude}`}
              latitude={formData.latitude}
              longitude={formData.longitude}
              address={formData.address || ""}
              onLocationChange={(address, latitude, longitude) => {
                setFormData((previous) => ({
                  ...previous,
                  address,
                  latitude,
                  longitude,
                }));
              }}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Severity"
                value={formData.severity}
                onChange={(event) =>
                  updateField("severity", event.target.value as Severity)
                }
                error={errors.severity}
              >
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Severity[]).map(
                  (value) => (
                    <option key={value} value={value}>
                      {getSeverityMeta(value).label}
                    </option>
                  )
                )}
              </Select>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">
                    Category
                  </span>

                  <button
                    type="button"
                    onClick={() => categorySuggestion.mutate()}
                    disabled={
                      categorySuggestion.isPending ||
                      !formData.title.trim() ||
                      !formData.description.trim()
                    }
                    className="rounded border border-cyber-cyan/40 px-3 py-1.5 text-xs font-semibold text-cyber-cyan transition-colors hover:bg-cyber-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {categorySuggestion.isPending
                      ? "Suggesting..."
                      : "Suggest with AI"}
                  </button>
                </div>

                <Select
                  label="Category"
                  value={formData.category}
                  onChange={(event) =>
                    updateField(
                      "category",
                      event.target.value as IncidentCategory
                    )
                  }
                  error={errors.category}
                >
                  {INCIDENT_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {getCategoryMeta(value).label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {isEdit && allowedStatuses.length > 0 && (
  <Select
    label=" Status"
    value={status}
    onChange={(event) =>
      setStatus(event.target.value as IncidentStatus | "")
    }
  >
    <option value="">Keep current status</option>

    {allowedStatuses.map((value) => (
      <option key={value} value={value}>
        {value}
      </option>
    ))}
  </Select>
)}

            <div className="space-y-4 rounded-lg border border-platinum-800 bg-platinum-950 p-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyber-cyan">
                Evidence Media
              </h3>

              <div className="space-y-2">
                <p className="text-xs font-medium text-platinum-400">
                  Images (Max {MAX_IMAGE_COUNT}, 5MB each)
                </p>

                <div className="flex flex-wrap gap-2">
                  {imagePreviews.map((url, index) => (
                    <div
                      key={url}
                      className="relative h-20 w-20 overflow-hidden rounded border border-platinum-700"
                    >
                      <img
                        src={url}
                        alt={`Incident evidence ${index + 1}`}
                        className="h-full w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label={`Remove image ${index + 1}`}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-alert-red/80 text-[10px] text-white hover:bg-alert-red"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {images.length < MAX_IMAGE_COUNT && (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center rounded border border-dashed border-platinum-700 bg-platinum-900 text-platinum-500 hover:border-cyber-cyan/50 hover:bg-platinum-800 transition-colors"
                    >
                      <span className="text-xl">+</span>
                      <span className="text-[10px]">Add Image</span>
                    </button>
                  )}
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-platinum-400">
                  Video (Optional, Max 50MB)
                </p>

                {videoPreview ? (
                  <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded border border-platinum-700">
                    <video
                      src={videoPreview}
                      controls
                      className="h-full w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={removeVideo}
                      aria-label="Remove video"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-alert-red/80 text-xs text-white hover:bg-alert-red"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="flex h-20 w-full flex-col items-center justify-center rounded border border-dashed border-platinum-700 bg-platinum-900 text-platinum-500 hover:border-cyber-cyan/50 hover:bg-platinum-800 transition-colors"
                  >
                    <span className="text-xl">+</span>
                    <span className="text-[10px]">Add Video</span>
                  </button>
                )}

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoChange}
                />
              </div>
            </div>

            {apiError && (
              <div
                role="alert"
                className="rounded border border-alert-red/20 bg-alert-red/10 p-3 text-sm text-alert-red"
              >
                {apiError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => navigate(-1)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>

              <Button type="submit" isLoading={saveMutation.isPending}>
                {isEdit ? "Save Changes" : "Report Incident"}
              </Button>
            </div>
          </form>
        </Card>
      </QueryState>
    </div>
  );
};

export default IncidentForm;
