import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery event from URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    if (type !== "recovery") {
      // Also check query params
      const queryParams = new URLSearchParams(window.location.search);
      const qType = queryParams.get("type");
      if (qType !== "recovery") {
        // Listen for auth state change for recovery
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") {
            // User is now authenticated via recovery link
          }
        });
        return () => subscription.unsubscribe();
      }
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast.success("Password updated successfully!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-[450px] min-h-screen sm:min-h-[600px] bg-background sm:rounded-[3rem] sm:shadow-[0_40px_100px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative">
        <div className="w-full bg-primary pt-12 pb-20 px-8 rounded-b-[3.5rem] shadow-[0_20px_40px_rgba(var(--primary-rgb),0.25)] relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
          <div className="relative">
            <h1 className="text-3xl font-black italic tracking-tighter text-primary-foreground leading-none">
              RESET
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <div className="h-[1px] w-8 bg-primary-foreground/30" />
              <p className="text-[10px] text-primary-foreground/80 font-black uppercase tracking-[0.3em]">
                Password
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 -mt-8 z-10">
          <div className="glass-card rounded-3xl p-6 space-y-5 bg-white shadow-xl border border-white/20">
            {success ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <h2 className="text-lg font-black text-foreground">Password Updated!</h2>
                <p className="text-xs text-muted-foreground">Redirecting to login...</p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-lg font-black text-foreground">Set New Password</h2>
                  <p className="text-xs text-muted-foreground mt-1">Enter your new password below</p>
                </div>
                <form onSubmit={handleReset} className="space-y-3">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      placeholder="New Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-bold border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-bold border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Update Password</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="mt-auto pb-8 text-center">
          <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest italic">
            Expense Tracker v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
