import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import type { UserRole } from "../../types/api";

import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: "/admin/users",
  COORDINATOR: "/dashboard",
  RESPONDER: "/assignments",
  VIEWER: "/dashboard",
};

const Login = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  if (isAuthenticated) return <Navigate to={from} replace />;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");
    const parsed = loginSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((issue) => {
        const field = issue.path[0];
        if (field && !fieldErrors[String(field)]) fieldErrors[String(field)] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const authenticatedUser = await login(parsed.data.email, parsed.data.password);
      const requestedPath =
        (from === "/dashboard" || from === "/") && authenticatedUser
          ? ROLE_HOME[authenticatedUser.role]
          : from;
      navigate(requestedPath, { replace: true });
    } catch (error) {
      setApiError(getErrorMessage(error, "Unable to sign in"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-tactical-950 px-4 py-12 sm:px-6 lg:px-8 tactical-grid">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyber-cyan/5 blur-3xl" />
      <div className="relative w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-cyber-cyan/50 bg-tactical-800 text-cyber-cyan shadow-neon-cyan">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-cyber-cyan">RESCUEGRID AI // SECURE ACCESS</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white">Tactical Command Login</h1>
          <p className="mt-2 text-sm text-platinum-700">Authenticate to access emergency response operations.</p>
        </div>

        <div className="glass-panel rounded-xl p-6 sm:p-8">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <Input name="email" type="email" label="Email address" placeholder="you@agency.gov" value={formData.email} onChange={handleChange} error={errors.email} autoComplete="email" required />
            <Input name="password" type="password" label="Password" placeholder="Enter your password" value={formData.password} onChange={handleChange} error={errors.password} autoComplete="current-password" required />
            {apiError && <div role="alert" className="rounded-lg border border-alert-red/40 bg-alert-red/10 px-4 py-3 text-sm text-alert-red">{apiError}</div>}
            <Button type="submit" size="lg" fullWidth isLoading={isSubmitting || isLoading}>Sign in / Establish secure session</Button>
          </form>
        </div>

        <p className="text-center text-sm text-platinum-700">
          Need an account? <Link to="/register" className="rounded font-medium text-cyber-cyan hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan">Register as a viewer</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
