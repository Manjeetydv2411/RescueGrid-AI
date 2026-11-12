export class OfflineSyncService {
  private dbName = "rescuegrid_offline_db";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private isOnlineStatus: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;
  private listeners: ((online: boolean, pendingCount: number) => void)[] = [];
  private syncInProgress = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnlineStatusChange(true));
      window.addEventListener("offline", () => this.handleOnlineStatusChange(false));
    }
    this.initDB().catch((err) => console.error("Failed to init IndexedDB:", err));
  }

  private async initDB(): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("incidents")) {
          db.createObjectStore("incidents", { keyPath: "_id" });
        }
        if (!db.objectStoreNames.contains("sync_queue")) {
          db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "key" });
        }
      };
    });
  }

  public getIsOnline(): boolean {
    return this.isOnlineStatus;
  }

  public subscribe(listener: (online: boolean, pendingCount: number) => void): () => void {
    this.listeners.push(listener);
    this.getPendingCount().then((count) => listener(this.isOnlineStatus, count));
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private async notifyListeners(): Promise<void> {
    const count = await this.getPendingCount();
    for (const listener of this.listeners) {
      listener(this.isOnlineStatus, count);
    }
  }

  private async handleOnlineStatusChange(online: boolean): Promise<void> {
    this.isOnlineStatus = online;
    await this.notifyListeners();
    if (online) {
      this.triggerSync();
    }
  }

  public async cacheIncidents(incidents: any[]): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["incidents", "metadata"], "readwrite");
      const store = transaction.objectStore("incidents");
      const metaStore = transaction.objectStore("metadata");

      store.clear();
      for (const inc of incidents) {
        store.put(inc);
      }

      metaStore.put({ key: "lastSyncTime", value: new Date().toISOString() });

      transaction.oncomplete = () => {
        this.notifyListeners();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async getCachedIncidents(): Promise<any[]> {
    if (!this.db) await this.initDB();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["incidents"], "readonly");
      const store = transaction.objectStore("incidents");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async getLastSyncTime(): Promise<string | null> {
    if (!this.db) await this.initDB();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["metadata"], "readonly");
      const store = transaction.objectStore("metadata");
      const request = store.get("lastSyncTime");

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  }

  public async queueAction(action: {
    type: "UPDATE_STATUS" | "ASSIGNMENT_ACTION";
    endpoint: string;
    method: string;
    payload: any;
    idempotencyKey: string;
  }): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");

      const item = {
        ...action,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        retries: 0,
      };

      const request = store.add(item);
      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async getPendingCount(): Promise<number> {
    if (!this.db) await this.initDB();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["sync_queue"], "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  }

  public async clearUserData(): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["incidents", "sync_queue", "metadata"], "readwrite");
      transaction.objectStore("incidents").clear();
      transaction.objectStore("sync_queue").clear();
      transaction.objectStore("metadata").clear();

      transaction.oncomplete = () => {
        this.notifyListeners();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async triggerSync(): Promise<void> {
    if (this.syncInProgress || !this.getIsOnline()) return;
    this.syncInProgress = false;
  }
}

export const offlineSyncService = new OfflineSyncService();
