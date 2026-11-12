import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { adminApi } from "../../services/api";
import type { AuditLogEntry } from "../../types/api";
import Card from "../../components/common/Card";
import Input from "../../components/common/Input";
import Pagination from "../../components/common/Pagination";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import Table, { type Column } from "../../components/common/Table";
import { RoleBadge } from "../../components/common/StatusBadge";
import useClampPage from "../../hooks/useClampPage";

const ENTITIES = ["USER", "INCIDENT", "RESOURCE", "ASSIGNMENT", "NOTIFICATION"];

const AuditLog = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const entity = searchParams.get("entity") ?? "";
  const action = searchParams.get("action") ?? "";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const limit = Math.max(Number(searchParams.get("limit") ?? "50") || 50, 1);

  const [actionInput, setActionInput] = useState(action);
  const [debouncedAction, setDebouncedAction] = useState(action);

  useEffect(() => {
    setActionInput(action);
  }, [action]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedAction(actionInput), 350);
    return () => window.clearTimeout(timer);
  }, [actionInput]);

  const updateParams = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next);
  };

  useEffect(() => {
    if (debouncedAction === action) return;
    updateParams({ action: debouncedAction || undefined, page: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAction]);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      entity: entity || undefined,
      action: action || undefined,
    }),
    [page, limit, entity, action]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: () => adminApi.getAuditLogs(queryParams),
    placeholderData: (previous) => previous,
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const isAdjustingPage = useClampPage(pagination, (next) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(next));
    setSearchParams(nextParams, { replace: true });
  });

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "action",
      header: "Tactical Action",
      render: (entry) => (
        <span className="font-mono text-xs font-semibold text-cyber-cyan">
          {entry.action}
        </span>
      ),
    },
    {
      key: "entity",
      header: "Entity / ID",
      render: (entry) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{entry.entity}</p>
          <p className="truncate font-mono text-[11px] text-platinum-700">
            {entry.entityId}
          </p>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Operator",
      render: (entry) => {
        const actor =
          entry.actorId && typeof entry.actorId === "object"
            ? entry.actorId
            : null;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {actor?.name ?? "Unknown"}
            </p>
            {actor?.email && (
              <p className="truncate font-mono text-xs text-platinum-700">{actor.email}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      hideBelow: "sm",
      render: (entry) => <RoleBadge role={entry.actorRole} size="sm" />,
    },
    {
      key: "details",
      header: "Payload Details",
      hideBelow: "lg",
      render: (entry) => (
        <span className="block max-w-xs truncate font-mono text-[11px] text-platinum-700">
          {entry.details && Object.keys(entry.details).length > 0
            ? JSON.stringify(entry.details)
            : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Timestamp",
      hideBelow: "md",
      render: (entry) => (
        <span className="font-mono text-xs text-platinum-700">
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-cyber-cyan/15 pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
            ADMIN // SYSTEM AUDIT TRAIL
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Secure Audit Trail
        </h1>
        <p className="mt-0.5 font-mono text-sm text-platinum-700">
          {pagination
            ? `${pagination.total} immutable audit record${pagination.total === 1 ? "" : "s"}.`
            : "Chronological security log of privileged command actions."}
        </p>
      </div>

      <Card>
        <form
          role="search"
          aria-label="Filter audit entries"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ action: actionInput || undefined, page: undefined });
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Entity filter"
              value={entity}
              onChange={(event) => updateParams({ entity: event.target.value, page: undefined })}
            >
              <option value="">All entities</option>
              {ENTITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Input
              label="Action search"
              placeholder="e.g. INCIDENT_CREATED"
              value={actionInput}
              onChange={(event) => setActionInput(event.target.value)}
            />
          </div>
        </form>
      </Card>

      <QueryState
        isLoading={isLoading || (isAdjustingPage && !isError)}
        isError={isError}
        error={error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["audit-logs"] })}
        loadingMessage="Loading audit log records…"
        errorTitle="Unable to load the audit trail"
        isEmpty={logs.length === 0}
        emptyTitle="No audit entries match filters"
      >
        <Card flush>
          <Table
            columns={columns}
            rows={logs}
            rowKey={(entry) => entry._id}
            caption="Secure audit trail"
            emptyMessage="No audit logs found."
          />
        </Card>

        {pagination && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              itemLabel="entries"
              onPageChange={(next) => updateParams({ page: next })}
              onLimitChange={(next) => updateParams({ limit: next, page: undefined })}
            />
          </div>
        )}
      </QueryState>
    </div>
  );
};

export default AuditLog;
