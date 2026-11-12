import Badge from "./Badge";
import {
  getAssignmentStatusMeta,
  getCategoryMeta,
  getIncidentStatusMeta,
  getResourceStatusMeta,
  getRoleMeta,
  getSeverityMeta,
} from "../../utils/domain";
import type {
  AssignmentStatus,
  IncidentCategory,
  IncidentStatus,
  ResourceStatus,
  Severity,
  UserRole,
} from "../../types/api";

interface BaseProps {
  /** Overrides the displayed label; defaults to the canonical label. */
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Incident workflow status. Renders the same label and colour everywhere an
 * incident status is shown.
 */
export const IncidentStatusBadge = ({
  status,
  label,
  size = "md",
  className,
}: BaseProps & { status?: IncidentStatus | string }) => {
  const meta = getIncidentStatusMeta(status);
  return (
    <Badge color={meta.tone} size={size} dot className={className} title={meta.description}>
      {label ?? meta.label}
    </Badge>
  );
};

/** Incident severity. */
export const SeverityBadge = ({
  severity,
  label,
  size = "md",
  className,
}: BaseProps & { severity?: Severity | string }) => {
  const meta = getSeverityMeta(severity);
  return (
    <Badge color={meta.tone} size={size} dot className={className} title={meta.description}>
      {label ?? meta.label}
    </Badge>
  );
};

/** Incident category. */
export const CategoryBadge = ({
  category,
  label,
  size = "md",
  className,
}: BaseProps & { category?: IncidentCategory | string }) => {
  const meta = getCategoryMeta(category);
  return (
    <Badge color={meta.tone} size={size} className={className} title={meta.description}>
      {label ?? meta.label}
    </Badge>
  );
};

/** Resource availability. */
export const ResourceStatusBadge = ({
  status,
  label,
  size = "md",
  className,
}: BaseProps & { status?: ResourceStatus | string }) => {
  const meta = getResourceStatusMeta(status);
  return (
    <Badge color={meta.tone} size={size} dot className={className} title={meta.description}>
      {label ?? meta.label}
    </Badge>
  );
};

/** Assignment workflow status. */
export const AssignmentStatusBadge = ({
  status,
  label,
  size = "md",
  className,
}: BaseProps & { status?: AssignmentStatus | string }) => {
  const meta = getAssignmentStatusMeta(status);
  return (
    <Badge color={meta.tone} size={size} dot className={className} title={meta.description}>
      {label ?? meta.label}
    </Badge>
  );
};

/** Operational role. */
export const RoleBadge = ({
  role,
  label,
  size = "md",
  className,
}: BaseProps & { role?: UserRole | string }) => {
  const meta = getRoleMeta(role);
  return (
    <Badge color={meta.tone} size={size} className={className} title={meta.description}>
      {label ?? meta.label}
    </Badge>
  );
};
