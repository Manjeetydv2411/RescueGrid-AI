import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { notificationApi } from "../../services/api";
import useClampPage from "../../hooks/useClampPage";
import type { AppNotification } from "../../types/api";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Pagination from "../../components/common/Pagination";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import Table, { type Column } from "../../components/common/Table";

const NotificationList = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const readFilter = searchParams.get("read") ?? "";
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
      unread: readFilter === "false" ? true : undefined,
    }),
    [page, limit, readFilter]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["notifications", queryParams],
    queryFn: () => notificationApi.list(queryParams),
    placeholderData: (previous) => previous,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to update notifications"
      );
    },
  });

  const markOneReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const notifications = data?.data ?? [];
  const pagination = data?.pagination;

  const isAdjustingPage = useClampPage(pagination, (next) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(next));
    setSearchParams(nextParams, { replace: true });
  });

  const columns: Column<AppNotification>[] = [
    {
      key: "status",
      header: <span className="sr-only">Read status</span>,
      render: (notification) => (
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            notification.isRead ? "bg-platinum-600" : "bg-cyber-cyan animate-pulse"
          }`}
          title={notification.isRead ? "Read" : "Unread"}
        />
      ),
    },
    {
      key: "message",
      header: "Alert Notification",
      render: (notification) => (
        <div className="min-w-0">
          <p className={`text-sm ${notification.isRead ? "text-platinum-700 font-normal" : "text-white font-semibold"}`}>
            {notification.message}
          </p>
          <p className="font-mono text-[11px] text-platinum-700">
            Type: <span className="text-cyber-cyan">{notification.type}</span>
          </p>
        </div>
      ),
    },
    {
      key: "timestamp",
      header: "Time",
      hideBelow: "md",
      render: (notification) => (
        <span className="font-mono text-xs text-platinum-700">
          {new Date(notification.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (notification) => {
        if (notification.isRead) return null;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markOneReadMutation.mutate(notification._id)}
          >
            Mark read
          </Button>
        );
      },
    },
  ];

  const hasFilters = Boolean(readFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-cyber-cyan/15 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
              TELEMETRY // ALERTS & LOGS
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Command Notifications
          </h1>
          <p className="mt-0.5 font-mono text-sm text-platinum-700">
            {pagination
              ? `${pagination.total} notification${pagination.total === 1 ? "" : "s"} total.`
              : "Real-time dispatch and emergency alerts."}
          </p>
        </div>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            isLoading={markAllReadMutation.isPending}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Select
            label="Filter by state"
            value={readFilter}
            onChange={(event) => updateParams({ read: event.target.value, page: undefined })}
            className="sm:w-48"
          >
            <option value="">All notifications</option>
            <option value="false">Unread only</option>
            <option value="true">Read only</option>
          </Select>

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
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["notifications"] })}
        loadingMessage="Loading notifications…"
        errorTitle="Unable to load notifications"
        isEmpty={notifications.length === 0}
        emptyTitle="No notifications found"
        emptyDescription="Your command feed is quiet."
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
            rows={notifications}
            rowKey={(n) => n._id}
            caption="Command notifications"
            emptyMessage="No notifications found."
          />
        </Card>

        {pagination && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              itemLabel="notifications"
              onPageChange={(next) => updateParams({ page: next })}
              onLimitChange={(next) => updateParams({ limit: next, page: undefined })}
            />
          </div>
        )}
      </QueryState>
    </div>
  );
};

export default NotificationList;
