import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, CheckCircle, XCircle, Settings, FileSpreadsheet, BarChart3, Loader2, Shield, DollarSign } from "lucide-react";

type Tab = "expenses" | "users" | "limits" | "reports";

export default function AdminPage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("expenses");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [expRes, usrRes, limRes] = await Promise.all([
      supabase.from("expenses").select("*, profiles!expenses_user_id_fkey(name, email)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*, user_roles(role)"),
      supabase.from("category_limits").select("*"),
    ]);
    setExpenses(expRes.data || []);
    setUsers(usrRes.data || []);
    setLimits(limRes.data || []);
    setLoading(false);
  };

  const approveUser = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({ is_approved: true }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("User approved!"); loadData(); }
  };

  const approveExpense = async (expenseId: string) => {
    const { error } = await supabase.from("expenses").update({
      status: "approved",
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", expenseId);
    if (error) toast.error(error.message);
    else { toast.success("Expense approved!"); loadData(); }
  };

  const rejectExpense = async (expenseId: string) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    const { error } = await supabase.from("expenses").update({
      status: "rejected",
      rejected_reason: reason,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", expenseId);
    if (error) toast.error(error.message);
    else { toast.success("Expense rejected"); loadData(); }
  };

  const settleExpense = async (expenseId: string) => {
    const { error } = await supabase.from("expenses").update({
      status: "settled",
      settled_at: new Date().toISOString(),
    }).eq("id", expenseId);
    if (error) toast.error(error.message);
    else { toast.success("Expense settled!"); loadData(); }
  };

  const updateLimit = async (id: string, newLimit: number) => {
    const { error } = await supabase.from("category_limits").update({
      daily_limit: newLimit,
      updated_by: user?.id,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Limit updated!"); loadData(); }
  };

  const makeAdmin = async (userId: string) => {
    const { error } = await supabase.from("user_roles").update({ role: "admin" as any }).eq("user_id", userId);
    if (error) toast.error(error.message);
    else { toast.success("User promoted to admin!"); loadData(); }
  };

  const exportCSV = () => {
    if (expenses.length === 0) return toast.error("No data to export");
    let csv = "Date,User,Category,Description,Amount,Status\n";
    expenses.forEach(e => {
      csv += `${e.date},"${e.profiles?.name || ""}",${e.category},"${e.description}",${e.amount},${e.status}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "expenses", label: "Expenses", icon: <DollarSign className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { key: "limits", label: "Limits", icon: <Settings className="w-4 h-4" /> },
    { key: "reports", label: "Reports", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-foreground p-5 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => navigate("/")} className="text-background/60 hover:text-background transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black italic tracking-tighter text-background">Admin Panel</h1>
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-background/10 text-background/50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pb-24">
        {/* Expenses Tab */}
        {tab === "expenses" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-foreground text-sm">All Expenses</h2>
              <button onClick={exportCSV} className="text-[9px] font-black uppercase bg-success/10 text-success px-3 py-1.5 rounded-lg flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" /> Export
              </button>
            </div>
            {expenses.map(e => (
              <div key={e.id} className="bg-card p-3 rounded-2xl border border-border shadow-sm animate-fade-in">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">{e.profiles?.name || "Unknown"}</p>
                    <p className="text-xs font-bold text-foreground">{e.description || "No description"}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[8px] uppercase font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">{e.category}</span>
                      <span className="text-[8px] text-muted-foreground font-bold">{e.date}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-foreground">₹{Number(e.amount).toLocaleString()}</p>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                      e.status === "pending" ? "bg-status-pending/20 text-status-pending" :
                      e.status === "approved" ? "bg-status-approved/20 text-status-approved" :
                      e.status === "rejected" ? "bg-status-rejected/20 text-status-rejected" :
                      "bg-status-settled/20 text-status-settled"
                    }`}>{e.status}</span>
                  </div>
                </div>
                {e.status === "pending" && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => approveExpense(e.id)} className="flex-1 py-2 bg-success/10 text-success rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => rejectExpense(e.id)} className="flex-1 py-2 bg-destructive/10 text-destructive rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
                {e.status === "approved" && (
                  <button onClick={() => settleExpense(e.id)} className="w-full mt-2 py-2 bg-primary/10 text-primary rounded-xl text-[9px] font-black uppercase">
                    Mark Settled
                  </button>
                )}
                {e.rejected_reason && (
                  <p className="text-[9px] text-destructive mt-1 italic">Reason: {e.rejected_reason}</p>
                )}
              </div>
            ))}
            {expenses.length === 0 && <p className="text-center text-muted-foreground text-xs py-8">No expenses yet</p>}
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="space-y-3">
            <h2 className="font-black text-foreground text-sm">User Management</h2>
            {users.map(u => (
              <div key={u.id} className="bg-card p-3 rounded-2xl border border-border shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black text-foreground">{u.name || "No name"}</p>
                    <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                      u.user_roles?.[0]?.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    }`}>
                      {u.user_roles?.[0]?.role || "user"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!u.is_approved && (
                      <button onClick={() => approveUser(u.id)} className="bg-success/10 text-success px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">
                        Approve
                      </button>
                    )}
                    {u.is_approved && u.user_roles?.[0]?.role !== "admin" && (
                      <button onClick={() => makeAdmin(u.id)} className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">
                        Make Admin
                      </button>
                    )}
                    {u.is_approved && (
                      <span className="bg-success/10 text-success px-2 py-1.5 rounded-lg text-[9px] font-black">✓</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Limits Tab */}
        {tab === "limits" && (
          <div className="space-y-3">
            <h2 className="font-black text-foreground text-sm">Category Daily Limits</h2>
            {limits.map(l => (
              <div key={l.id} className="bg-card p-3 rounded-2xl border border-border shadow-sm flex justify-between items-center">
                <span className="text-xs font-black uppercase text-foreground">{l.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">₹</span>
                  <input
                    type="number"
                    defaultValue={l.daily_limit}
                    onBlur={e => updateLimit(l.id, parseFloat(e.target.value) || 0)}
                    className="w-20 text-right text-sm font-black text-foreground bg-secondary p-1.5 rounded-lg border border-border outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reports Tab */}
        {tab === "reports" && (
          <div className="space-y-4">
            <h2 className="font-black text-foreground text-sm">Reports & Analytics</h2>
            
            {/* Category Breakdown */}
            <div className="bg-foreground text-background p-4 rounded-2xl shadow-xl">
              <h4 className="text-xs font-black italic tracking-tight mb-4">Category Breakdown</h4>
              <div className="space-y-2.5">
                {["travel", "meal", "hotel", "luggage", "cash", "other"].map(cat => {
                  const catTotal = expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
                  const maxTotal = Math.max(...["travel", "meal", "hotel", "luggage", "cash", "other"].map(c => expenses.filter(e => e.category === c).reduce((s, e) => s + Number(e.amount), 0)), 1);
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-[7px] w-10 uppercase font-black text-background/40 tracking-tighter">{cat}</span>
                      <div className="flex-1 h-1 bg-background/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          cat === "travel" ? "bg-category-travel" :
                          cat === "meal" ? "bg-category-meal" :
                          cat === "hotel" ? "bg-category-hotel" :
                          cat === "cash" ? "bg-category-cash" :
                          "bg-warning"
                        }`} style={{ width: `${(catTotal / maxTotal) * 100}%` }} />
                      </div>
                      <span className="text-[9px] font-black italic w-14 text-right tracking-tighter text-background/70">₹{catTotal.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-2 gap-2">
              {(["pending", "approved", "rejected", "settled"] as const).map(status => {
                const count = expenses.filter(e => e.status === status).length;
                return (
                  <div key={status} className="bg-card p-3 rounded-2xl border border-border text-center">
                    <p className="text-2xl font-black text-foreground">{count}</p>
                    <p className={`text-[8px] font-black uppercase tracking-wider ${
                      status === "pending" ? "text-status-pending" :
                      status === "approved" ? "text-status-approved" :
                      status === "rejected" ? "text-status-rejected" :
                      "text-status-settled"
                    }`}>{status}</p>
                  </div>
                );
              })}
            </div>

            <button onClick={exportCSV} className="w-full py-3 bg-success text-success-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Export Full Report (CSV)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
