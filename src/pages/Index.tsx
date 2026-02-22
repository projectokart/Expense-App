import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Settings, History, X, Image as ImageIcon, Maximize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ImagePreviewModal from "@/components/expense/ImagePreviewModal";
// Components
import ExpenseForm from "@/components/expense/ExpenseForm";
import ExpenseSummaryCard from "@/components/expense/ExpenseSummaryCard";
import MissionPanel from "@/components/expense/MissionPanel";
import JourneyLogbook from "@/components/expense/JourneyLogbook";

export default function UserDashboard() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeMission, setActiveMission] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]); 
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    if (!user) return;
    
    // 1. Fetch active mission
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

    // 2. Fetch expenses
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => setExpenses(data || []));

    // 3. Fetch settlements
    supabase
      .from("settlements")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSettlements(data || []));

    // 4. Fetch limits
    supabase
      .from("category_limits")
      .select("category, daily_limit")
      .then(({ data }) => {
        const limits: Record<string, number> = {};
        data?.forEach(l => { limits[l.category] = Number(l.daily_limit); });
        setCategoryLimits(limits);
      });
  }, [user, refreshKey]);

  // --- Calculations ---
  const todayStr = new Date().toISOString().split("T")[0];
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  
  const totalApprovedExpense = expenses
    .filter(e => e.status === 'approved' && e.category !== "cash")
    .reduce((s, e) => s + Number(e.amount), 0);
  
  const totalReceived = settlements.reduce((s, e) => s + Number(e.amount), 0);
  const todayTotal = todayExpenses.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
  const todayReceived = settlements
    .filter(s => s.created_at?.startsWith(todayStr))
    .reduce((s, e) => s + Number(e.amount), 0);

  const pendingAmount = totalApprovedExpense - totalReceived;

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      {/* Header */}
      <div className="flex-shrink-0 bg-primary p-5 pb-10 rounded-b-4xl shadow-lg relative overflow-hidden">
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-primary-foreground leading-none uppercase">
              Expense
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5 opacity-90">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-primary-foreground/80">
                Welcome, {profile?.name || "User"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {role === "admin" && (
              <button onClick={() => navigate("/admin")} className="bg-primary-foreground/10 p-2 rounded-xl text-primary-foreground border border-white/10 active:scale-90 transition-all">
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button onClick={signOut} className="bg-primary-foreground/10 p-2 rounded-xl text-primary-foreground border border-white/10 active:scale-90 transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <MissionPanel activeMission={activeMission} userId={user?.id || ""} onMissionChange={refresh} />
      </div>

      {/* Summary Cards */}
      <div className="px-3 -mt-5 space-y-4 z-20">
        <ExpenseSummaryCard
          totalReceived={totalReceived}
          totalExpense={totalApprovedExpense}
          todayExpense={todayTotal}
          todayReceived={todayReceived}
        />
        
        <div className="flex justify-between items-center bg-card p-4 rounded-3xl border border-border shadow-sm mx-1">
          <div>
            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Account Status</p>
            <h4 className={`text-xs font-black italic ${pendingAmount > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
              {pendingAmount > 0 ? `₹${pendingAmount.toLocaleString()} Pending` : `₹${Math.abs(pendingAmount).toLocaleString()} Advance`}
            </h4>
          </div>
          <button 
            onClick={() => setShowSettlementModal(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-2xl active:scale-95 transition-all shadow-md"
          >
            <History className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-tighter">See Receiving</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-y-auto scrollbar-hide px-4 pt-6 pb-24">
        {activeMission ? (
          <ExpenseForm userId={user?.id || ""} missionId={activeMission.id} categoryLimits={categoryLimits} todayExpenses={todayExpenses} onSaved={refresh} />
        ) : (
          <div className="bg-muted/30 border-2 border-dashed border-muted rounded-[2.5rem] p-10 text-center mb-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            No Active Mission Found
          </div>
        )}
        <JourneyLogbook userId={user?.id || ""} refreshKey={refreshKey} />
      </div>

      {/* 🧾 COMPACT RECEIVING LEDGER MODAL */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-card w-full max-w-[420px] rounded-[2.5rem] border border-border shadow-2xl animate-in slide-in-from-bottom-10 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/10">
              <h3 className="font-black italic text-base tracking-tighter uppercase leading-none">Receiving History</h3>
              <button onClick={() => setShowSettlementModal(false)} className="bg-muted p-2 rounded-full active:scale-90 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-2 overflow-y-auto space-y-1 custom-scrollbar">
              {settlements.length > 0 ? settlements.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/10 border border-border/40 hover:bg-muted/30 transition-all group">
                  {/* Thumbnail - Calls ImagePreviewModal via setSelectedImage */}
                  {s.proof_url ? (
                    <div 
                      onClick={() => setSelectedImage(s.proof_url)}
                      className="relative w-12 h-12 rounded-xl overflow-hidden border border-border flex-shrink-0 cursor-pointer active:scale-90 transition-transform shadow-sm"
                    >
                      <img src={s.proof_url} className="w-full h-full object-cover" alt="receipt" />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 border border-dashed border-border">
                      <ImageIcon className="w-4 h-4 opacity-20" />
                    </div>
                  )}

                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="font-black italic text-sm text-foreground">₹{Number(s.amount).toLocaleString()}</p>
                      <p className="text-[8px] font-bold opacity-40 uppercase">{new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</p>
                    </div>
                    
                    <div className="flex flex-col">
                      {/* 👤 Yahan map kiya hua Profile Name dikhega */}
                      <p className="text-[9px] font-black text-primary uppercase truncate mt-0.5">
                        Received From: {s.admin?.name || s.received_from || 'Official Admin'}
                      </p>
                      
                      {s.notes && (
                        <p className="text-[8px] font-medium text-muted-foreground/70 truncate italic mt-0.5">
                          Note: {s.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 opacity-40 font-black text-[10px] uppercase italic tracking-widest leading-relaxed">
                  No Receiving Records
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border bg-card">
               <button 
                 onClick={() => setShowSettlementModal(false)} 
                 className="w-full py-3.5 bg-foreground text-background rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
               >
                 Close Ledger
               </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ IMAGE PREVIEW MODAL COMPONENT CALL */}
      <ImagePreviewModal 
        imageUrl={selectedImage} 
        onClose={() => setSelectedImage(null)} 
      />
    
    </div>
  );
}
