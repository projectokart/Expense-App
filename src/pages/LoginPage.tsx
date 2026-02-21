import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { user, profile, loading, signIn, signUp, signOut } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>);

  }

  if (user && profile?.is_approved) {
    return <Navigate to="/" replace />;
  }

  if (user && profile && !profile.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-warning/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-xl font-black text-foreground">Account Pending</h2>
          <p className="text-sm text-muted-foreground">
            Your account is awaiting admin approval. You'll be able to log in once approved.
          </p>
          <button
            onClick={async () => {await signOut();window.location.reload();}}
            className="text-sm text-primary font-bold">

            Sign out
          </button>
        </div>
      </div>);

  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, name);
        if (error) throw error;
        toast.success("Account created! Awaiting admin approval.");
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    }
    setSubmitting(false);
  };

  return (
  <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-0 sm:p-4">
    {/* Desktop par size control karne ke liye main container */}
    <div className="w-full max-w-[450px] min-h-screen sm:min-h-[850px] bg-background sm:rounded-[3rem] sm:shadow-[0_40px_100px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative">
      
      {/* Header Area - Design as per your request */}
      <div className="w-full bg-primary pt-12 pb-20 px-8 rounded-b-[3.5rem] shadow-[0_20px_40px_rgba(var(--primary-rgb),0.25)] relative overflow-hidden flex-shrink-0">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black italic tracking-tighter text-primary-foreground leading-none">
              EXPENSE
            </h1>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse mt-2" />
          </div>
          
          <div className="flex items-center gap-3 mt-2">
            <div className="h-[1px] w-8 bg-primary-foreground/30" />
            <p className="text-[10px] text-primary-foreground/80 font-black uppercase tracking-[0.3em]">
              Tracker Pro
            </p>
          </div>
        </div>
      </div>

      {/* Form Card Area - Design NOT changed, only positioning fixed */}
      <div className="px-4 -mt-8 z-10">
        <div className="glass-card rounded-3xl p-6 space-y-5 bg-white shadow-xl border border-white/20">
          <div className="text-center">
            <h2 className="text-lg font-black text-foreground">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isSignUp ? "Sign up to start tracking expenses" : "Sign in to continue"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-bold border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground" 
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
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-bold border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground" 
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-bold border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground" 
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Sign Up" : "Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-bold">
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>

      {/* Footer (Optional spacer for desktop look) */}
      <div className="mt-auto pb-8 text-center">
        <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest italic">
          Expense Tracker v2.0
        </p>
      </div>
    </div>
  </div>
);

}
