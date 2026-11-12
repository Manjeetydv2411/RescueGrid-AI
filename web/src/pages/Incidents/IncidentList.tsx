import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { incidentApi } from "../../services/api";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_STATUSES,
  SEVERITIES,
  getCategoryMeta,
  getIncidentStatusMeta,
  getSeverityMeta,
} from "../../utils/domain";
import type { IncidentCategory, IncidentStatus, Severity } from "../../types/api";
import Button, { ButtonLink } from "../../components/common/Button";
import Card from "../../components/common/Card";
import Input from "../../components/common/Input";
import Pagination from "../../components/common/Pagination";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import {
  CategoryBadge,
  IncidentStatusBadge,
  SeverityBadge,
} from "../../components/common/StatusBadge";
import { SOCKET_EVENTS, useSocket } from "../../hooks/useSocket";
import useClampPage from "../../hooks/useClampPage";

const SORT_OPTIONS = [
  { value: "createdAt", label: "Reported date" },
  { value: "updatedAt", label: "Last updated" },
  { value: "priority", label: "Priority" },
  { value: "severity", label: "Severity" },
  { value: "status", label: "Status" },
  { value: "title", label: "Title" },
];

const IncidentList = () => {
  const queryClient = useQueryClient();
  const { onEvent } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") ?? "") as IncidentStatus | "";
  const severity = (searchParams.get("severity") ?? "") as Severity | "";
  const category = (searchParams.get("category") ?? "") as IncidentCategory | "";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const limit = Math.max(Number(searchParams.get("limit") ?? "20") || 20, 1);

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") ?? "");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

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
      severity: severity || undefined,
      category: category || undefined,
      search: searchParams.get("search") || undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, status, severity, category, searchParams, sortBy, sortOrder]
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["incidents", queryParams],
    queryFn: () => incidentApi.list(queryParams),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
    };
    const unsubscribers = [
      onEvent(SOCKET_EVENTS.INCIDENT_CREATED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_ASSIGNED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_UNASSIGNED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [onEvent, queryClient]);

  const incidents = data?.data ?? [];
  const pagination = data?.pagination;

  const isAdjustingPage = useClampPage(pagination, (next) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(next));
    setSearchParams(nextParams, { replace: true });
  });

  const hasFilters = Boolean(status || severity || category || searchParams.get("search"));

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-cyber-cyan/15 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
              OPERATIONS // INCIDENT REGISTRY
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Emergency Incidents & SOS
          </h1>
          <p className="mt-0.5 font-mono text-sm text-platinum-700">
            {pagination
              ? `${pagination.total} incident${pagination.total === 1 ? "" : "s"} matching tactical filter parameters.`
              : "Filter, search, and inspect emergency incident reports."}
          </p>
        </div>
        <ButtonLink to="/incidents/new">Report emergency</ButtonLink>
      </div>

      <Card>
        <form
          role="search"
          aria-label="Filter incidents"
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams(searchParams);
            if (searchInput) next.set("search", searchInput);
            else next.delete("search");
            next.delete("page");
            setSearchParams(next);
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Search telemetry"
              type="search"
              placeholder="Title, description, address"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select
              label="Status filter"
              value={status}
              onChange={(event) => updateParams({ status: event.target.value, page: undefined })}
            >
              <option value="">All statuses</option>
              {INCIDENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {getIncidentStatusMeta(value).label}
                </option>
              ))}
            </Select>
            <Select
              label="Severity filter"
              value={severity}
              onChange={(event) => updateParams({ severity: event.target.value, page: undefined })}
            >
              <option value="">All severities</option>
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {getSeverityMeta(value).label}
                </option>
              ))}
            </Select>
            <Select
              label="Category"
              value={category}
              onChange={(event) => updateParams({ category: event.target.value, page: undefined })}
            >
              <option value="">All categories</option>
              {INCIDENT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {getCategoryMeta(value).label}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-cyber-cyan/15 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
              <Select
                label="Sort parameter"
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
                label="Sort order"
                value={sortOrder}
                onChange={(event) => updateParams({ sortOrder: event.target.value, page: undefined })}
                className="sm:w-36"
              >
                <option value="desc">Highest / newest</option>
                <option value="asc">Lowest / oldest</option>
              </Select>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
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
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["incidents"] })}
        loadingMessage="Loading incident database…"
        errorTitle="Unable to load incidents"
        isEmpty={incidents.length === 0}
        emptyTitle="No incidents match parameters"
        emptyDescription={
          hasFilters
            ? "Try adjusting tactical filter parameters or clearing search."
            : "No emergency incidents recorded in the system."
        }
        emptyAction={
          hasFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <ButtonLink to="/incidents/new">Report first incident</ButtonLink>
          )
        }
      >
        <Card flush>
          {isFetching && !isLoading && (
            <p className="border-b border-cyber-cyan/15 px-4 py-2 font-mono text-xs text-cyber-cyan" role="status">
              SYNCING TELEMETRY FEED...
            </p>
          )}
          <ul className="divide-y divide-cyber-cyan/10">
            {incidents.map((incident) => (
              <li key={incident._id}>
                <Link
                  to={`/incidents/${incident._id}`}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-cyber-cyan/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyber-cyan sm:flex-row sm:items-start sm:justify-between sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <IncidentStatusBadge status={incident.status} />
                      <SeverityBadge severity={incident.severity} />
                      <CategoryBadge category={incident.category} />
                    </div>
                    <h2 className="mt-2 truncate text-base font-bold text-white flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan" />
                      {incident.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-platinum-700">
                      {incident.description}
                    </p>
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-platinum-700">
                      <div className="flex gap-1">
                        <dt>Reported:</dt>
                        <dd className="font-medium text-platinum-800">
                          {new Date(incident.createdAt).toLocaleString()}
                        </dd>
                      </div>
                      {incident.address && (
                        <div className="flex gap-1">
                          <dt>Location:</dt>
                          <dd className="font-medium text-platinum-800">
                            {incident.address}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
                    <div className="text-center sm:text-right">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-platinum-700">
                        Priority Index
                      </div>
                      <div className="font-mono text-2xl font-black tabular-nums text-warn-amber">
                        {incident.priority ?? 0}
                        <span className="text-xs font-normal text-platinum-700">/10</span>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold text-cyber-cyan">Inspect →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {pagination && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              itemLabel="incidents"
              onPageChange={(next) => updateParams({ page: next })}
              onLimitChange={(next) => updateParams({ limit: next, page: undefined })}
            />
          </div>
        )}
      </QueryState>
    </div>
  );
};

export default IncidentList;
