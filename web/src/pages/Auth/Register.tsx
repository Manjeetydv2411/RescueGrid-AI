import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/\d/, "Password must contain a number"),
  confirmPassword: z.string().min(1, "Confirm your password"),
  phone: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register = () => {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

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
    setSuccess("");

    const parsed = registerSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((issue) => {
        const field = issue.path[0];
        if (field && !fieldErrors[String(field)]) {
          fieldErrors[String(field)] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      await register({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        phone: parsed.data.phone || undefined,
      });
      setSuccess("Account created. You can now sign in.");
      navigate("/login", { replace: true });
    } catch (error) {
      setApiError(getErrorMessage(error, "Unable to create the account"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-tactical-950 px-4 py-12 sm:px-6 lg:px-8 tactical-grid">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyber-cyan/5 blur-3xl" />
      <div className="relative w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-cyber-cyan/50 bg-tactical-800 text-cyber-cyan shadow-neon-cyan">RG</div>
          <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-cyber-cyan">RESCUEGRID AI // OPERATOR REGISTRY</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white">Create viewer access</h1>
          <p className="mt-2 text-sm text-platinum-700">New accounts start read-only. An administrator can raise your role.</p>
        </div>

        <div className="glass-panel rounded-xl p-6 sm:p-8">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              name="name"
              type="text"
              label="Full name"
              placeholder="Jane Okafor"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              autoComplete="name"
              required
            />

            <Input
              name="email"
              type="email"
              label="Email address"
              placeholder="you@agency.gov"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
              required
            />

            <Input
              name="phone"
              type="tel"
              label="Phone"
              placeholder="Optional contact number"
              value={formData.phone}
              onChange={handleChange}
              error={errors.phone}
              autoComplete="tel"
            />

            <Input
              name="password"
              type="password"
              label="Password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="new-password"
              hint="Use at least 8 characters, including a letter and a number."
              required
            />

            <Input
              name="confirmPassword"
              type="password"
              label="Confirm password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              autoComplete="new-password"
              required
            />

            {apiError && (
              <div
                role="alert"
                className="rounded-lg border border-alert-red/40 bg-alert-red/10 px-4 py-3 text-sm text-alert-red"
              >
                {apiError}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-lg border border-safe-green/40 bg-safe-green/10 px-4 py-3 text-sm text-safe-green"
              >
                {success}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
            >
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-platinum-800">
          Already registered?{" "}
          <Link
            to="/login"
            className="rounded font-medium text-cyber-cyan hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
