import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import toast from "react-hot-toast";

import { adminApi } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { USER_ROLES, getRoleMeta } from "../../utils/domain";
import type { User, UserRole } from "../../types/api";
import Card from "../../components/common/Card";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Pagination from "../../components/common/Pagination";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import Table, { type Column } from "../../components/common/Table";
import { RoleBadge } from "../../components/common/StatusBadge";
import useClampPage from "../../hooks/useClampPage";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(12, "Use at least 12 characters"),
  role: z.enum(["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"]),
  phone: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

const UserManagement = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = (searchParams.get("role") ?? "") as UserRole | "";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const limit = Math.max(Number(searchParams.get("limit") ?? "20") || 20, 1);

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") ?? "");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    password: "",
    role: "RESPONDER",
    phone: "",
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
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
      role: role || undefined,
      search: searchParams.get("search") || undefined,
    }),
    [page, limit, role, searchParams]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users", queryParams],
    queryFn: () => adminApi.getUsers(queryParams),
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserForm) => adminApi.createUser(data),
    onSuccess: (created) => {
      setIsCreateOpen(false);
      setCreateForm({ name: "", email: "", password: "", role: "RESPONDER", phone: "" });
      setCreateErrors({});
      toast.success(`${created.name} was added as a ${getRoleMeta(created.role).label.toLowerCase()}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Unable to create the account");
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: UserRole }) =>
      adminApi.updateUserRole(id, nextRole),
    onSuccess: (updated) => {
      toast.success(`${updated.name} is now a ${getRoleMeta(updated.role).label.toLowerCase()}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to update the role"
      );
    },
  });

  const users = data?.data ?? [];
  const pagination = data?.pagination;

  const isAdjustingPage = useClampPage(pagination, (next) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(next));
    setSearchParams(nextParams, { replace: true });
  });

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Operator",
      render: (account) => (
        <div className="min-w-0">
          <p className="font-semibold text-white">
            {account.name}
            {account._id === currentUser?._id && (
              <span className="ml-2 font-mono text-xs text-cyber-cyan">
                (you)
              </span>
            )}
          </p>
          <p className="truncate font-mono text-xs text-platinum-700">{account.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Access Role",
      render: (account) => <RoleBadge role={account.role} />,
    },
    {
      key: "availability",
      header: "Status",
      hideBelow: "sm",
      render: (account) =>
        account.isAvailable === false ? (
          <span className="font-mono text-xs text-platinum-700">Off duty</span>
        ) : (
          <span className="font-mono text-xs text-safe-green">Available</span>
        ),
    },
    {
      key: "phone",
      header: "Contact",
      hideBelow: "lg",
      render: (account) => <span className="font-mono text-xs">{account.phone ?? "—"}</span>,
    },
    {
      key: "created",
      header: "Registered",
      hideBelow: "md",
      render: (account) =>
        account.createdAt ? (
          <span className="font-mono text-xs text-platinum-700">
            {new Date(account.createdAt).toLocaleDateString()}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Change role</span>,
      render: (account) => {
        const isSelf = account._id === currentUser?._id;
        return (
          <Select
            aria-label={`Change role for ${account.name}`}
            value={account.role}
            disabled={isSelf}
            onChange={(event) => {
              const nextRole = event.target.value as UserRole;
              if (nextRole === account.role) return;
              roleMutation.mutate({ id: account._id, nextRole });
            }}
            className="min-w-[9rem] text-xs font-mono"
          >
            {USER_ROLES.map((value) => (
              <option key={value} value={value}>
                {getRoleMeta(value).label}
              </option>
            ))}
          </Select>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cyber-cyan/15 pb-4">
        <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-warn-amber" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-warn-amber">
            ADMIN // SECURITY & ROLES
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Operator Roster Management
        </h1>
        <p className="mt-0.5 font-mono text-sm text-platinum-700">
          {pagination
            ? `${pagination.total} registered operator account${pagination.total === 1 ? "" : "s"}.`
            : "Review operator accounts and modify security roles."}
        </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>Create operator account</Button>
      </div>

      <Card>
        <form
          role="search"
          aria-label="Filter users"
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams(searchParams);
            if (searchInput) next.set("search", searchInput);
            else next.delete("search");
            next.delete("page");
            setSearchParams(next);
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Search operators"
              type="search"
              placeholder="Name or email address"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select
              label="Role filter"
              value={role}
              onChange={(event) => updateParams({ role: event.target.value, page: undefined })}
            >
              <option value="">All roles</option>
              {USER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {getRoleMeta(value).label}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Card>

      <QueryState
        isLoading={isLoading || (isAdjustingPage && !isError)}
        isError={isError}
        error={error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["admin-users"] })}
        loadingMessage="Loading operator accounts…"
        errorTitle="Unable to load operator accounts"
        isEmpty={users.length === 0}
        emptyTitle="No accounts match filters"
      >
        <Card flush>
          <Table
            columns={columns}
            rows={users}
            rowKey={(account) => account._id}
            caption="Registered operator accounts"
            emptyMessage="No operators found."
          />
        </Card>

        {pagination && (
          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              itemLabel="accounts"
              onPageChange={(next) => updateParams({ page: next })}
              onLimitChange={(next) => updateParams({ limit: next, page: undefined })}
            />
          </div>
        )}
      </QueryState>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          if (!createMutation.isPending) setIsCreateOpen(false);
        }}
        title="Create operator account"
        description="Only administrators can provision accounts and assign operational roles."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              isLoading={createMutation.isPending}
              onClick={() => {
                const parsed = createUserSchema.safeParse(createForm);
                if (!parsed.success) {
                  const next: Record<string, string> = {};
                  parsed.error.issues.forEach((issue) => {
                    const field = issue.path[0];
                    if (field && !next[String(field)]) next[String(field)] = issue.message;
                  });
                  setCreateErrors(next);
                  return;
                }
                setCreateErrors({});
                createMutation.mutate(parsed.data);
              }}
            >
              Create account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full name" value={createForm.name} error={createErrors.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required />
          <Input label="Email address" type="email" autoComplete="off" value={createForm.email} error={createErrors.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} required />
          <Input label="Temporary password" type="password" autoComplete="new-password" hint="At least 12 characters. Share it securely and ask the operator to change it." value={createForm.password} error={createErrors.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} required />
          <Input label="Phone" type="tel" value={createForm.phone} error={createErrors.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} />
          <Select label="Assigned role" value={createForm.role} error={createErrors.role} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as UserRole }))} required>
            {USER_ROLES.map((value) => <option key={value} value={value}>{getRoleMeta(value).label}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default UserManagement;
