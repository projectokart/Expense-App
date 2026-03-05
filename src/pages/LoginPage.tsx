import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const { user, loading, role, profile, signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);

  // Redirect based on role after login, or block unapproved users
  useEffect(() => {
    if (!loading && user && profile) {
      if (!profile.is_approved) {
        toast.error("Your account is not approved yet. Please contact admin.");
        signOut();
        return;
      }
      if (role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, loading, role, profile, navigate, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email aur password dono daalo");
      return;
    }
    if (isSignUp && !name.trim()) {
      toast.error("Apna naam daalo");
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email.trim(), password, name.trim());
        if (error) throw error;
        toast.success("Sign up successful! Please check your email to verify your account.");
        setIsSignUp(false);
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
        // Approval check happens in useEffect after profile loads
      }
    } catch (err: any) {
      toast.error(err?.message || (isSignUp ? "Sign up failed" : "Login failed - check credentials"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent to your email.");
      setIsForgotPassword(false);
      setResetEmail("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reset email");
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="bg-primary pt-10 pb-16 px-8 rounded-t-3xl text-center">
          <h1 className="text-2xl font-black italic tracking-tighter text-primary-foreground">
            EXPENSE TRACKER
          </h1>
          <p className="text-xs text-primary-foreground/70 mt-1 uppercase tracking-widest font-bold">
            {isForgotPassword
              ? "Reset your password"
              : isSignUp
              ? "Create your account"
              : "Sign in to continue"}
          </p>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-b-3xl -mt-6 pt-10 pb-8 px-6 shadow-lg">
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-medium border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="submit"
                disabled={resetSending}
                className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-wider shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resetSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Send Reset Link <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <p className="text-center text-sm text-muted-foreground mt-3">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-primary font-semibold hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-medium border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-medium border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-secondary text-foreground text-sm font-medium border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {!isSignUp && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-wider shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>{isSignUp ? "Sign Up" : "Sign In"} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-5">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary font-semibold hover:underline"
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
