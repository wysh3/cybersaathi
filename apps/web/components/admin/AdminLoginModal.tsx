"use client";

import { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (name: string, role: string) => void;
}

export function AdminLoginModal({ open, onClose, onLoginSuccess }: AdminLoginModalProps) {
  const [officerId, setOfficerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId.trim() || !password.trim()) {
      setError("Please enter both Officer ID and Password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api.adminLogin({
        officer_id: officerId.trim(),
        password,
      });
      if (result.success) {
        onLoginSuccess(result.name, result.role);
        onClose();
        setOfficerId("");
        setPassword("");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid credentials. Access attempt logged.";
      setError(message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-[24px] border border-white/60 bg-white/90 p-8 shadow-glass-strong backdrop-blur-xl",
          shake && "animate-[shake_0.4s_ease-in-out]",
        )}
        style={
          shake
            ? { animation: "shake 0.4s ease-in-out" }
            : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label="Authority Access Login"
      >
        {/* Icon */}
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <ShieldCheck className="size-7" aria-hidden />
        </div>

        <h2 className="text-center text-xl font-bold tracking-tight text-ink-900">
          Authority Access — CyberSaathi Portal
        </h2>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-officer-id">Officer ID</Label>
            <Input
              id="admin-officer-id"
              type="text"
              placeholder="Enter your Officer ID"
              value={officerId}
              onChange={(e) => setOfficerId(e.target.value)}
              disabled={loading}
              autoComplete="username"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                className="h-12 rounded-xl pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-sky-700 font-semibold text-white hover:bg-sky-800"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              "Access Portal"
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-500">
          Authorised law enforcement personnel only. All access is logged.
        </p>
      </div>
    </div>
  );
}
