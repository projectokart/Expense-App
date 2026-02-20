import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExpenseForm from "@/components/expense/ExpenseForm";
import ExpenseSummaryCard from "@/components/expense/ExpenseSummaryCard";
import MissionPanel from "@/components/expense/MissionPanel";
import ExpenseTimeline from "@/components/expense/ExpenseTimeline";
import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UserDashboard() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeMission, setActiveMission] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    if (!user) return;
    // Fetch active mission
    supabase
      .from("missions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setActiveMission(data[0]);
        else setActiveMission(null);
      });

    // Fetch expenses
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => setExpenses(data || []));

    // Fetch limits
    supabase
      .from("category_limits")
      .select("category, daily_limit")
      .then(({ data }) => {
        const limits: Record<string, number> = {};
        data?.forEach(l => { limits[l.category] = Number(l.daily_limit); });
        setCategoryLimits(limits);
      });
  }, [user, refreshKey]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const todayTotal = todayExpenses.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
  const todayReceived = todayExpenses.filter(e => e.category === "cash").reduce((s, e) => s + Number(e.amount), 0);
  const totalExpense = expenses.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
  const totalReceived = expenses.filter(e => e.category === "cash").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 bg-primary p-5 pb-10 rounded-b-4xl shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-primary-foreground leading-none">
              Expense
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5 opacity-90">
              <div className="w-2 h-2 bg-warning rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-wider text-primary-foreground/80">
                Welcome, {profile?.name || "User"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="bg-primary-foreground/10 p-2 rounded-xl text-primary-foreground"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={signOut}
              className="bg-primary-foreground/10 p-2 rounded-xl text-primary-foreground"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <MissionPanel
          activeMission={activeMission}
          userId={user?.id || ""}
          onMissionChange={refresh}
        />
      </div>

      {/* Summary Cards */}
      <div className="px-3 -mt-5 space-y-2">
        <ExpenseSummaryCard
          totalReceived={totalReceived}
          totalExpense={totalExpense}
          todayExpense={todayTotal}
          todayReceived={todayReceived}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-grow overflow-y-auto scrollbar-hide px-4 pb-24">
        {activeMission && (
          <ExpenseForm
            userId={user?.id || ""}
            missionId={activeMission.id}
            categoryLimits={categoryLimits}
            todayExpenses={todayExpenses}
            onSaved={refresh}
          />
        )}

        <ExpenseTimeline expenses={expenses} />
      </div>
    </div>
  );
}
