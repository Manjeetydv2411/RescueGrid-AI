import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { broadcastApi, type BroadcastRecord, type BroadcastDeliveryRecord } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import useClampPage from "../../hooks/useClampPage";
import { SEVERITIES, getSeverityMeta } from "../../utils/domain";
import type { Severity } from "../../types/api";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Modal from "../../components/common/Modal";
import Pagination from "../../components/common/Pagination";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import Table, { type Column } from "../../components/common/Table";
import { SeverityBadge } from "../../components/common/StatusBadge";
import BroadcastAlertModal from "../../components/BroadcastAlertModal";

const BroadcastList = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);

  const severityFilter = (searchParams.get("severity") as Severity | "") ?? "";
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
      severity: severityFilter || undefined,
    }),
    [page, limit, severityFilter]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["broadcasts", queryParams],
    queryFn: () => broadcastApi.list(queryParams),
    placeholderData: (previous) => previous,
  });

  const broadcasts = data?.data ?? [];
  const pagination = data?.pagination;

  const isAdjustingPage = useClampPage(pagination, (next) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(next));
    setSearchParams(nextParams, { replace: true });
  });

  const canBroadcast = hasRole("ADMIN", "COORDINATOR");

  const columns: Column<BroadcastRecord>[] = [
    {
      key: "title",
      header: "Emergency Broadcast",
      render: (item) => (
        <div className="min-w-0">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-alert-red animate-pulse" />
            {item.title}
          </p>
          <p className="mt-0.5 text-xs text-platinum-700 line-clamp-1">
            {item.message}
          </p>
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (item) => <SeverityBadge severity={item.severity} />,
    },
    {
      key: "channels",
      header: "Channels",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.channels.map((ch) => (
            <span key={ch} className="rounded bg-cyber-cyan/10 px-1.5 py-0.5 font-mono text-[10px] text-cyber-cyan border border-cyber-cyan/30">
              {ch}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "deliveries",
      header: "Deliveries (Success / Sim / Fail)",
      render: (item) => (
        <div className="font-mono text-xs text-platinum-800">
          <span className="text-safe-green font-bold">{item.successfulDeliveries}</span>
          <span className="text-platinum-700"> / </span>
          <span className="text-cyber-cyan">{item.simulatedDeliveries}</span>
          <span className="text-platinum-700"> / </span>
          <span className="text-alert-red">{item.failedDeliveries}</span>
          <span className="text-platinum-700 ml-1">({item.totalRecipients} total)</span>
        </div>
      ),
    },
    {
      key: "time",
      header: "Dispatched At",
      render: (item) => (
        <span className="font-mono text-xs text-platinum-700">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedBroadcastId(item._id)}
        >
          Inspect Deliveries
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-cyber-cyan/15 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-alert-red animate-pulse" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
              COMMAND CENTER // EMERGENCY ALERTS
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Multi-Channel Emergency Broadcasts
          </h1>
          <p className="mt-0.5 font-mono text-sm text-platinum-700">
            {pagination ? `${pagination.total} broadcast${pagination.total === 1 ? "" : "s"} recorded.` : "Emergency dispatch history and channel delivery telemetry."}
          </p>
        </div>

        {canBroadcast && (
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            className="bg-alert-red hover:bg-alert-red/90 text-white font-medium"
          >
            + Dispatch Broadcast
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Select
            label="Filter by severity"
            value={severityFilter}
            onChange={(e) => updateParams({ severity: e.target.value, page: undefined })}
            className="sm:w-48"
          >
            <option value="">All severities</option>
            {SEVERITIES.map((sev) => (
              <option key={sev} value={sev}>
                {getSeverityMeta(sev).label}
              </option>
            ))}
          </Select>

          {severityFilter && (
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
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["broadcasts"] })}
        loadingMessage="Loading broadcast telemetry..."
        errorTitle="Unable to load broadcasts"
        isEmpty={broadcasts.length === 0}
        emptyTitle="No emergency broadcasts found"
        emptyDescription="No multi-channel alerts have been dispatched yet."
      >
        <Card flush>
          <Table
            columns={columns}
            rows={broadcasts}
            rowKey={(b) => b._id}
            caption="Emergency broadcasts"
            emptyMessage="No broadcasts found."
          />
        </Card>

        {pagination && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              itemLabel="broadcasts"
              onPageChange={(next) => updateParams({ page: next })}
              onLimitChange={(next) => updateParams({ limit: next, page: undefined })}
            />
          </div>
        )}
      </QueryState>

      {canBroadcast && (
        <BroadcastAlertModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {selectedBroadcastId && (
        <BroadcastDetailModal
          broadcastId={selectedBroadcastId}
          onClose={() => setSelectedBroadcastId(null)}
        />
      )}
    </div>
  );
};

const BroadcastDetailModal = ({ broadcastId, onClose }: { broadcastId: string; onClose: () => void }) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["broadcast-detail", broadcastId],
    queryFn: () => broadcastApi.get(broadcastId),
  });

  const broadcast = data?.broadcast;
  const deliveries = data?.deliveries ?? [];

  const deliveryColumns: Column<BroadcastDeliveryRecord>[] = [
    {
      key: "recipient",
      header: "Recipient",
      render: (d) => (
        <div>
          <p className="text-sm font-bold text-white">{d.userId?.name ?? "Unknown User"}</p>
          <p className="font-mono text-xs text-platinum-700">{d.userId?.email} | Role: {d.userId?.role}</p>
        </div>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (d) => (
        <span className="rounded bg-cyber-cyan/10 px-2 py-0.5 font-mono text-xs text-cyber-cyan border border-cyber-cyan/30">
          {d.channel}
        </span>
      ),
    },
    {
      key: "address",
      header: "Recipient Address",
      render: (d) => <span className="font-mono text-xs text-platinum-800">{d.recipientAddress}</span>,
    },
    {
      key: "status",
      header: "Delivery Status",
      render: (d) => {
        const isSimulated = d.status === "SIMULATED";
        const isDelivered = d.status === "DELIVERED" || d.status === "SENT";
        const isFailed = d.status === "FAILED";
        return (
          <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold uppercase ${
            isDelivered ? "bg-safe-green/20 text-safe-green border border-safe-green/30" :
            isSimulated ? "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30" :
            isFailed ? "bg-alert-red/20 text-alert-red border border-alert-red/30" :
            "bg-warn-amber/20 text-warn-amber border border-warn-amber/30"
          }`}>
            {d.status}
          </span>
        );
      },
    },
    {
      key: "time",
      header: "Delivered At",
      render: (d) => (
        <span className="font-mono text-xs text-platinum-700">
          {d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : "Pending / Failed"}
        </span>
      ),
    },
  ];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Broadcast Telemetry & Delivery Report"
      description="Per-recipient channel transmission status and gateway responses."
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close Report</Button>}
    >
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        loadingMessage="Loading broadcast delivery report..."
        errorTitle="Unable to load delivery details"
      >
        {broadcast && (
          <div className="space-y-4">
            <div className="rounded-lg bg-tactical-950 p-4 border border-cyber-cyan/20 font-mono text-xs space-y-2">
              <h3 className="text-sm font-bold text-white mb-2">{broadcast.title}</h3>
              <p className="text-platinum-700 whitespace-pre-wrap">{broadcast.message}</p>
              <div className="flex flex-wrap gap-4 pt-2 border-t border-cyber-cyan/15 text-platinum-700">
                <span>Severity: <strong className="text-white">{broadcast.severity}</strong></span>
                <span>Sender: <strong className="text-white">{broadcast.senderId?.name}</strong></span>
                <span>Total Recipients: <strong className="text-cyber-cyan">{broadcast.totalRecipients}</strong></span>
                <span>Simulated: <strong className="text-cyber-cyan">{broadcast.simulatedDeliveries}</strong></span>
                <span>Failed: <strong className="text-alert-red">{broadcast.failedDeliveries}</strong></span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyber-cyan mb-2">
                Recipient Delivery Tracking ({deliveries.length} records)
              </h4>
              <Table
                columns={deliveryColumns}
                rows={deliveries}
                rowKey={(d) => d._id}
                caption="Delivery tracking records"
                emptyMessage="No delivery records found."
              />
            </div>
          </div>
        )}
      </QueryState>
    </Modal>
  );
};

export default BroadcastList;
