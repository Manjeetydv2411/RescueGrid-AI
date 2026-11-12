import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { resourceApi } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { SOCKET_EVENTS, useSocket } from "../../hooks/useSocket";
import useClampPage from "../../hooks/useClampPage";
import {
  RESOURCE_STATUSES,
  RESOURCE_STATUS_TRANSITIONS,
  getResourceStatusMeta,
} from "../../utils/domain";
import type { Resource, ResourceStatus } from "../../types/api";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Input from "../../components/common/Input";
import Pagination from "../../components/common/Pagination";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import Table, { type Column } from "../../components/common/Table";
import { ResourceStatusBadge } from "../../components/common/StatusBadge";
import ResourceCreateModal from "./ResourceCreateModal";

const SORT_OPTIONS = [
  { value: "lastUpdated", label: "Last updated" },
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
  { value: "category", label: "Category" },
  { value: "capacity", label: "Capacity" },
  { value: "status", label: "Status" },
];

const ResourceList = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { onEvent } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") ?? "") as ResourceStatus | "";
  const category = searchParams.get("category") ?? "";
  const type = searchParams.get("type") ?? "";
  const sortBy = searchParams.get("sortBy") ?? "lastUpdated";
  const sortOrder = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const limit = Math.max(Number(searchParams.get("limit") ?? "20") || 20, 1);

  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("search") ?? ""
  );

  // Category and type are free text, so they are typed into local state and
  // committed to the URL after a pause. Pushing them on every keystroke
  // would add a history entry and a request per character.
  const [categoryInput, setCategoryInput] = useState(category);
  const [typeInput, setTypeInput] = useState(type);
  const [debouncedCategory, setDebouncedCategory] = useState(category);
  const [debouncedType, setDebouncedType] = useState(type);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    setCategoryInput(category);
    setTypeInput(type);
  }, [category, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCategory(categoryInput), 350);
    return () => window.clearTimeout(timer);
  }, [categoryInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedType(typeInput), 350);
    return () => window.clearTimeout(timer);
  }, [typeInput]);

  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (debouncedSearch === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set("search", debouncedSearch);
    else next.delete("search");
    next.delete("page");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (debouncedCategory === category && debouncedType === type) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedCategory) next.set("category", debouncedCategory);
    else next.delete("category");
    if (debouncedType) next.set("type", debouncedType);
    else next.delete("type");
    next.delete("page");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCategory, debouncedType]);

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
      category: category || undefined,
      type: type || undefined,
      search: searchParams.get("search") || undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, status, category, type, searchParams, sortBy, sortOrder]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["resources", queryParams],
    queryFn: () => resourceApi.list(queryParams),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    };
    const unsubscribers = [
      onEvent(SOCKET_EVENTS.RESOURCE_CREATED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_STATUS_CHANGED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [onEvent, queryClient]);

  const availabilityMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: ResourceStatus }) =>
      resourceApi.updateAvailability(id, nextStatus),
    onSuccess: (resource) => {
      toast.success(
        `${resource.name} is now ${getResourceStatusMeta(resource.status).label.toLowerCase()}.`
      );
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to change the availability"
      );
    },
  });

  const resources = data?.data ?? [];
  const pagination = data?.pagination;
  const canManage = user?.role === "ADMIN" || user?.role === "COORDINATOR";

  // The page in the URL can outlive the results it refers to — a filter that
  // narrows the inventory, or a resource taken out of service. Without this
  // the page would claim that nothing matches the filters, which is not what
  // happened; the user is simply past the end of a shorter list.
  const isAdjustingPage = useClampPage(pagination, (next) => {
    // Replace rather than push: the correction is not a navigation the user
    // asked for, and it should not sit in the history as a separate entry.
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(next));
    setSearchParams(nextParams, { replace: true });
  });

  const columns: Column<Resource>[] = [
    {
      key: "name",
      header: "Resource",
      render: (resource) => (
        <div className="min-w-0">
          <p className="font-semibold text-platinum-900">{resource.name}</p>
          <p className="text-xs text-platinum-700">
            {resource.type} · {resource.category}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Availability",
      render: (resource) => <ResourceStatusBadge status={resource.status} />,
    },
    {
      key: "capacity",
      header: "Capacity",
      hideBelow: "sm",
      render: (resource) => (
        <span className="tabular-nums">
          {resource.capacity ?? "—"}
        </span>
      ),
    },
    {
      key: "location",
      header: "Coordinates",
      hideBelow: "lg",
      render: (resource) =>
        resource.location ? (
          <span className="font-mono text-xs text-platinum-700">
            {resource.location.coordinates[1].toFixed(3)},{" "}
            {resource.location.coordinates[0].toFixed(3)}
          </span>
        ) : (
          <span className="text-platinum-700">Not recorded</span>
        ),
    },
    {
      key: "contact",
      header: "Contact",
      hideBelow: "lg",
      render: (resource) => resource.contact ?? "—",
    },
    {
      key: "updated",
      header: "Last updated",
      hideBelow: "md",
      render: (resource) => (
        <span className="text-xs text-platinum-800">
          {new Date(resource.lastUpdated).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (resource) => {
        if (!canManage) {
          return <span className="text-xs text-platinum-700">View only</span>;
        }
        const next = RESOURCE_STATUS_TRANSITIONS[resource.status] ?? [];

        return (
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditingResource(resource);
                setIsCreateOpen(true);
              }}
            >
              Edit
            </Button>
            {next.length > 0 && (
              <Select
                aria-label={`Change availability for ${resource.name}`}
                value=""
                onChange={(event) => {
                  const value = event.target.value as ResourceStatus | "";
                  if (!value) return;
                  availabilityMutation.mutate({ id: resource._id, nextStatus: value });
                }}
                className="min-w-[9rem] text-xs"
              >
                <option value="">Change availability…</option>
                {next.map((value) => (
                  <option key={value} value={value}>
                    {getResourceStatusMeta(value).label}
                  </option>
                ))}
              </Select>
            )}
          </div>
        );
      },
    },
  ];

  const hasFilters = Boolean(status || category || type || searchParams.get("search"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-platinum-900">
            Resource Inventory
          </h1>
          <p className="mt-1 text-sm text-platinum-800">
            {pagination
              ? `${pagination.total} resource${pagination.total === 1 ? "" : "s"} in the inventory.`
              : "Track equipment, vehicles, and personnel pools."}
          </p>
        </div>
        {canManage && (
          <Button
            size="md"
            onClick={() => {
              setEditingResource(null);
              setIsCreateOpen(true);
            }}
            icon="+"
          >
            Add Resource
          </Button>
        )}
      </div>

      <Card>
        <form
          role="search"
          aria-label="Filter resources"
          onSubmit={(event) => {
            event.preventDefault();
            // Commit the typed filters immediately rather than waiting for the
            // debounce, so submitting does not appear to do nothing.
            const next = new URLSearchParams(searchParams);
            if (searchInput) next.set("search", searchInput);
            else next.delete("search");
            if (categoryInput) next.set("category", categoryInput);
            else next.delete("category");
            if (typeInput) next.set("type", typeInput);
            else next.delete("type");
            next.delete("page");
            setSearchParams(next);
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Search"
              type="search"
              placeholder="Name, type, or category"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select
              label="Availability"
              value={status}
              onChange={(event) =>
                updateParams({ status: event.target.value, page: undefined })
              }
            >
              <option value="">All statuses</option>
              {RESOURCE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {getResourceStatusMeta(value).label}
                </option>
              ))}
            </Select>
            <Input
              label="Category"
              placeholder="e.g. medical"
              value={categoryInput}
              onChange={(event) => setCategoryInput(event.target.value)}
            />
            <Input
              label="Type"
              placeholder="e.g. vehicle"
              value={typeInput}
              onChange={(event) => setTypeInput(event.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-platinum-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
              <Select
                label="Sort by"
                value={sortBy}
                onChange={(event) =>
                  updateParams({ sortBy: event.target.value, page: undefined })
                }
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
                onChange={(event) =>
                  updateParams({ sortOrder: event.target.value, page: undefined })
                }
                className="sm:w-36"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </Select>
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchParams(new URLSearchParams())}
              >
                Clear filters
              </Button>
            )}
          </div>
        </form>
      </Card>

      <QueryState
        isLoading={isLoading || (isAdjustingPage && !isError)}
        isError={isError}
        error={error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["resources"] })}
        loadingMessage="Loading resources…"
        errorTitle="Unable to load the resource inventory"
        isEmpty={resources.length === 0}
        emptyTitle="No resources match these filters"
        emptyDescription={
          hasFilters
            ? "Try widening the filters or clearing the search term."
            : "No resources have been added to the inventory yet."
        }
        emptyAction={
          hasFilters ? (
            <Button
              variant="secondary"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Clear filters
            </Button>
          ) : undefined
        }
      >
        <Card flush>
          <Table
            columns={columns}
            rows={resources}
            rowKey={(resource) => resource._id}
            caption="Resource inventory"
            emptyMessage="No resources found."
          />
        </Card>

        {pagination && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              itemLabel="resources"
              onPageChange={(next) => updateParams({ page: next })}
              onLimitChange={(next) => updateParams({ limit: next, page: undefined })}
            />
          </div>
        )}
      </QueryState>

      {canManage && (
        <ResourceCreateModal
          isOpen={isCreateOpen}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingResource(null);
          }}
          resource={editingResource}
        />
      )}
    </div>
  );
};

export default ResourceList;
