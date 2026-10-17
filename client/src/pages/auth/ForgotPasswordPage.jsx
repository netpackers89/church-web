import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { authService } from "../../services/api.js";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [completion, setCompletion] = useState("reset");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (step !== "verify" || resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setResendCooldown((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, resendCooldown]);

  async function submitRequest(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await authService.forgotPassword({ email });
      setMessage(response.data.message);
      setResendCooldown(60);
      setStep("verify");
    } catch (reason) {
      setError(reason.message || "Failed to send reset code.");
    } finally {
      setSaving(false);
    }
  }

  async function resendCode() {
    if (resendCooldown > 0 || saving) return;
    setError("");
    setSaving(true);
    try {
      const response = await authService.forgotPassword({ email });
      setOtp("");
      setMessage(response.data.message);
      setResendCooldown(60);
    } catch (reason) {
      setError(reason.message || "Failed to resend reset code.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCode(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await authService.verifyResetOtp({ email, otp });
      setResetToken(response.data.resetToken);
      setMessage(response.data.message);
      setStep("choice");
    } catch (reason) {
      setError(reason.message || "Invalid or expired code.");
    } finally {
      setSaving(false);
    }
  }

  async function keepPassword() {
    setError("");
    setSaving(true);
    try {
      const response = await authService.keepCurrentPassword({ resetToken });
      setCompletion("kept");
      setMessage(response.data.message);
      setStep("done");
    } catch (reason) {
      setError(reason.message || "Could not close the recovery request.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const response = await authService.resetPassword({
        resetToken,
        newPassword,
        confirmPassword,
      });
      setMessage(response.data.message);
      setStep("done");
    } catch (reason) {
      setError(reason.message || "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  }

  // Helper icons for each step header
  const stepIcons = {
    request: <Mail className="w-6 h-6 text-indigo-600" />,
    verify: <ShieldCheck className="w-6 h-6 text-indigo-600" />,
    choice: <ShieldCheck className="w-6 h-6 text-indigo-600" />,
    reset: <Lock className="w-6 h-6 text-indigo-600" />,
    done: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
  };

  const stepDescriptions = {
    request: "Enter your registered email address and we'll send you a 6-digit verification code.",
    verify: "Enter the code sent to your email. It expires in 5 minutes.",
    choice: "Your identity is verified. Choose whether to change your password.",
    reset: "Choose a secure new password for your account (10–128 characters).",
    done: completion === "kept" ? "Your password is unchanged. You can sign in with your current password." : "Your password has been changed successfully. You can now sign in.",
  };

  return (
    <div className="recovery-page min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="recovery-panel w-full max-w-md p-8 rounded-xl border"
      >
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
            step === "done" ? "bg-emerald-50" : "bg-indigo-50"
          }`}>
            {stepIcons[step]}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {step === "done" ? (completion === "kept" ? "Recovery Closed" : "Password Reset!") : "Password Recovery"}
          </h1>

          <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">
            {stepDescriptions[step]}
          </p>
        </div>

        {/* Status Messages */}
        <AnimatePresence mode="wait">
          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 p-3.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl"
            >
              {message}
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 p-3.5 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-xl"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Request Email */}
        {step === "request" && (
          <form onSubmit={submitRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 transition disabled:opacity-50"
            >
              {saving ? "Sending code..." : "Send Reset Code"}
            </button>
          </form>
        )}

        {/* Step 2: Verify OTP Code */}
        {step === "verify" && (
          <form onSubmit={submitCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                6-Digit Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                placeholder="123456"
                className="w-full px-4 py-3 text-center tracking-widest text-lg font-bold rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 transition disabled:opacity-50"
            >
              {saving ? "Verifying..." : "Verify Code"}
            </button>
            <button type="button" onClick={resendCode} disabled={saving || resendCooldown > 0} className="recovery-secondary w-full py-2.5 px-4 font-medium rounded-lg transition text-sm disabled:opacity-50">
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
            <button type="button" onClick={() => { setStep("request"); setResendCooldown(0); }} className="recovery-link w-full py-2 text-sm">
              Change email address
            </button>
          </form>
        )}

        {/* Step 3: Reset Password */}
        {step === "choice" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setStep("reset");
              }}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 transition"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={keepPassword}
              disabled={saving}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition disabled:opacity-50"
            >
              {saving ? "Closing recovery..." : "Keep My Current Password"}
            </button>
          </div>
        )}

        {step === "reset" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <span className="text-xs text-slate-400 mt-1 block">Must be 10–128 characters</span>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 transition disabled:opacity-50"
            >
              {saving ? "Updating password..." : "Reset Password"}
            </button>
          </form>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-3">
            <Link
              to="/login"
              className="block w-full text-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 transition"
            >
              Sign In Now
            </Link>
          </div>
        )}

        {/* Footer Navigation Links */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-3 text-sm">
          {step !== "done" && (
            <Link to="/login" className="text-slate-600 hover:text-indigo-600 font-medium transition flex items-center gap-1.5">
              <ArrowLeft size={16} /> Back to Sign In
            </Link>
          )}
          <Link to="/" className="text-slate-400 hover:text-slate-600 text-xs transition">
            ← Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}