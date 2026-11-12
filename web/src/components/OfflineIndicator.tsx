import React, { useEffect, useState } from "react";
import { offlineSyncService } from "../services/offlineSyncService";

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(offlineSyncService.getIsOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = offlineSyncService.subscribe((online, count) => {
      setIsOnline(online);
      setPendingCount(count);
      offlineSyncService.getLastSyncTime().then(setLastSync);
    });

    offlineSyncService.getLastSyncTime().then(setLastSync);

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    await offlineSyncService.triggerSync();
  };

  return (
    <div className={`flex items-center space-x-3 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      isOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
    }`}>
      <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-ping"}`} />
      <span>{isOnline ? "Online" : "Offline Mode"}</span>
      {pendingCount > 0 && (
        <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full text-[10px]">
          {pendingCount} pending
        </span>
      )}
      {!isOnline && lastSync && (
        <span className="text-slate-400 hidden sm:inline">
          Last synced: {new Date(lastSync).toLocaleTimeString()}
        </span>
      )}
      {pendingCount > 0 && isOnline && (
        <button
          onClick={handleManualSync}
          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded transition"
        >
          Sync Now
        </button>
      )}
    </div>
  );
};
