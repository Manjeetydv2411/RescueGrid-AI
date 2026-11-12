import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { assignmentApi } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import useClampPage from "../../hooks/useClampPage";
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_STATUS_TRANSITIONS,
  getAssignmentStatusMeta,
} from "../../utils/domain";
import type { Assignment, AssignmentStatus } from "../../types/api";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Pagination from "../../components/common/Pagination";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import Table, { type Column } from "../../components/common/Table";
import { AssignmentStatusBadge } from "../../components/common/StatusBadge";
import ResponderDashboard from "./ResponderDashboard";

const SORT_OPTIONS = [
  { value: "createdAt", label: "Dispatched date" },
  { value: "updatedAt", label: "Last updated" },
  { value: "status", label: "Status" },
];

const AssignmentList = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  if (user?.role === "RESPONDER") {
    return <ResponderDashboard />;
  }

  const status = (searchParams.get("status") ?? "") as AssignmentStatus | "";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const limit = Math.max(Number(searchParams.get("limit") ?? "20") || 20, 1);

  const updateParams = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next);
  };

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      status: status || undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, status, sortBy, sortOrder]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["assignments", queryParams],
    queryFn: () => assignmentApi.list(queryParams),
    placeholderData: (previous) => previous,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: AssignmentStatus }) =>
      assignmentApi.update(id, { status: nextStatus }),
    onSuccess: (assignment) => {
      toast.success(
        `Dispatch is now ${getAssignmentStatusMeta(assignment.status).label.toLowerCase()}.`
      );
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to update the dispatch status"
      );
    },
  });

  const assignments = data?.data ?? [];
  const pagination = data?.pagination;
  const canManage = user?.role === "ADMIN" || user?.role === "COORDINATOR";

  const isAdjustingPage = useClampPage(pagination, (next) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(next));
    setSearchParams(nextParams, { replace: true });
  });

  const columns: Column<Assignment>[] = [
    {
      key: "incidentId",
      header: "Incident / Target",
      render: (assignment) => (
        <div className="min-w-0">
          <p className="font-semibold text-white">
            {typeof assignment.incidentId === "object" && assignment.incidentId !== null
              ? (assignment.incidentId as { title?: string }).title ?? "Incident Record"
              : `Incident ID: ${String(assignment.incidentId)}`}
          </p>
          <p className="font-mono text-xs text-platinum-700">
            ID: {String(assignment.incidentId)}
          </p>
        </div>
      ),
    },
    {
      key: "resourceId",
      header: "Dispatched Resource",
      render: (assignment) => (
        <div className="min-w-0">
          <p className="font-medium text-white">
            {typeof assignment.resourceId === "object" && assignment.resourceId !== null
              ? (assignment.resourceId as { name?: string }).name ?? "Resource Asset"
              : assignment.resourceId
              ? `Resource ID: ${String(assignment.resourceId)}`
              : "Personnel / Unit"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (assignment) => <AssignmentStatusBadge status={assignment.status} />,
    },
    {
      key: "updated",
      header: "Last updated",
      hideBelow: "md",
      render: (assignment) => (
        <span className="font-mono text-xs text-platinum-700">
          {new Date(assignment.updatedAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (assignment) => {
        if (!canManage) {
          return <span className="font-mono text-xs text-platinum-700">View only</span>;
        }
        const next = ASSIGNMENT_STATUS_TRANSITIONS[assignment.status] ?? [];
        if (next.length === 0) return null;

        return (
          <Select
            aria-label="Change status for dispatch"
            value=""
            onChange={(event) => {
              const value = event.target.value as AssignmentStatus | "";
              if (!value) return;
              statusMutation.mutate({ id: assignment._id, nextStatus: value });
            }}
            className="min-w-[9rem] text-xs font-mono"
          >
            <option value="">Update status…</option>
            {next.map((value) => (
              <option key={value} value={value}>
                {getAssignmentStatusMeta(value).label}
              </option>
            ))}
          </Select>
        );
      },
    },
  ];

  const hasFilters = Boolean(status);

  return (
    <div className="space-y-6">
      <div className="border-b border-cyber-cyan/15 pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
            DISPATCHES // UNIT DEPLOYMENT
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Responder Dispatches
        </h1>
        <p className="mt-0.5 font-mono text-sm text-platinum-700">
          {pagination
            ? `${pagination.total} dispatch${pagination.total === 1 ? "" : "es"} in the network.`
            : "Monitor active unit assignments and dispatch progress."}
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row">
            <Select
              label="Status filter"
              value={status}
              onChange={(event) => updateParams({ status: event.target.value, page: undefined })}
              className="sm:w-48"
            >
              <option value="">All statuses</option>
              {ASSIGNMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {getAssignmentStatusMeta(value).label}
                </option>
              ))}
            </Select>
            <Select
              label="Sort by"
              value={sortBy}
              onChange={(event) => updateParams({ sortBy: event.target.value, page: undefined })}
              className="sm:w-48"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Order"
              value={sortOrder}
              onChange={(event) => updateParams({ sortOrder: event.target.value, page: undefined })}
              className="sm:w-36"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </Select>
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => setSearchParams(new URLSearchParams())}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      <QueryState
        isLoading={isLoading || (isAdjustingPage && !isError)}
        isError={isError}
        error={error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["assignments"] })}
        loadingMessage="Loading dispatches…"
        errorTitle="Unable to load unit dispatches"
        isEmpty={assignments.length === 0}
        emptyTitle="No dispatches found"
        emptyDescription="No unit dispatches match the current filter criteria."
        emptyAction={
          hasFilters ? (
            <Button variant="secondary" onClick={() => setSearchParams(new URLSearchParams())}>
              Clear filters
            </Button>
          ) : undefined
        }
      >
        <Card flush>
          <Table
            columns={columns}
            rows={assignments}
            rowKey={(assignment) => assignment._id}
            caption="Unit dispatches"
            emptyMessage="No dispatches found."
          />
        </Card>

        {pagination && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              itemLabel="dispatches"
              onPageChange={(next) => updateParams({ page: next })}
              onLimitChange={(next) => updateParams({ limit: next, page: undefined })}
            />
          </div>
        )}
      </QueryState>
    </div>
  );
};

export default AssignmentList;
