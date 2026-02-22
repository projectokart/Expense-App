import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Camera, Eye, Save, X, Loader2, 
  ChevronDown, Lock as LockKeyhole, ChevronRight // 'Lock as LockIcon' add kiya
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ImagePreviewModal from "./ImagePreviewModal";

const CATEGORY_DOT_COLORS: Record<string, string> = {
  travel: "bg-category-travel",
  meal: "bg-category-meal",
  hotel: "bg-category-hotel",
  luggage: "bg-category-luggage",
  cash: "bg-category-cash",
  other: "bg-category-other",
};

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-status-pending/20 text-status-pending",
  approved: "bg-status-approved/20 text-status-approved",
  rejected: "bg-status-rejected/20 text-status-rejected",
  settled: "bg-status-settled/20 text-status-settled",
};

interface Mission {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

interface Expense {
  id: string;
  mission_id: string | null;
  date: string;
  category: string;
  description: string;
  amount: number;
  image_url: string | null;
  status: string;
  approved_by: string | null;
  rejected_reason: string | null;
}

interface Props {
  userId: string;
  refreshKey: number;
}

export default function JourneyLogbook({ userId, refreshKey }: Props) {

// Layer 3 Collapse State
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Image Upload & Preview States
  const [selectedFile, setSelectedFile] = useState<{ [key: string]: File | null }>({});
  const [localPreview, setLocalPreview] = useState<{ [key: string]: string | null }>({});

  // Image Selection Function (Jo handleFileSelect wala error fix karega)
  const handleFileSelect = (entryId: string, file: File) => {
    setSelectedFile(prev => ({ ...prev, [entryId]: file }));
    setLocalPreview(prev => ({ ...prev, [entryId]: URL.createObjectURL(file) }));
  };

  const [missions, setMissions] = useState<Mission[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expandedMissions, setExpandedMissions] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ description: string; amount: string }>({ description: "", amount: "" });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      const [missionsRes, expensesRes] = await Promise.all([
        supabase.from("missions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("user_id", userId).order("date", { ascending: true }),
      ]);
      setMissions(missionsRes.data || []);
      setExpenses(expensesRes.data || []);
    };
    fetchData();
  }, [userId, refreshKey]);

  const activeMissions = missions.filter(m => m.status === "active" || m.status === "pending");
  const oldMissions = missions.filter(m => m.status === "finished" || m.status === "completed");

  const getExpensesForMission = (missionId: string) => expenses.filter(e => e.mission_id === missionId);

  const groupByDate = (items: Expense[]) => {
    const grouped: Record<string, Expense[]> = {};
    items.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  };

  const toggleMission = (missionId: string) => {
    setExpandedMissions(prev => {
      const next = new Set(prev);
      next.has(missionId) ? next.delete(missionId) : next.add(missionId);
      return next;
    });
  };

  const toggleDate = (key: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startEdit = (entry: Expense) => {
    setEditingRow(entry.id);
    setEditValues({ description: entry.description, amount: String(entry.amount) });
  };

 const saveEdit = async (entryId: string) => {
  console.log("Save process started for:", entryId);
  setSavingId(entryId);
  
  const currentEntry = expenses.find(e => e.id === entryId);
  let finalImageUrl = currentEntry?.image_url || null;

  try {
    // 1. Check if a new file is selected in local state
    if (selectedFile[entryId]) {
      console.log("New file detected, starting upload...");
      const file = selectedFile[entryId]!;
      
      // File name prepare karein
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // A. PURANI IMAGE DELETE (Optional but clean)
      if (currentEntry?.image_url) {
        const oldPath = currentEntry.image_url.split('/').pop();
        await supabase.storage.from("expense-receipts").remove([`${userId}/${oldPath}`]);
      }

      // B. ACTUAL UPLOAD
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("expense-receipts")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Storage Upload Error:", uploadError);
        throw new Error("Image upload failed: " + uploadError.message);
      }

      console.log("Upload successful:", uploadData.path);

      // C. GET PUBLIC URL
      const { data: urlData } = supabase.storage
        .from("expense-receipts")
        .getPublicUrl(uploadData.path);
        
      finalImageUrl = urlData.publicUrl;
      console.log("New Public URL:", finalImageUrl);
    }

    // 2. DATABASE UPDATE
    console.log("Updating Database with URL:", finalImageUrl);
    const { error: dbError } = await supabase
      .from("expenses")
      .update({
        description: editValues.description,
        amount: parseFloat(editValues.amount) || 0,
        image_url: finalImageUrl // Ye value null nahi honi chahiye agar upload hua hai
      })
      .eq("id", entryId);

    if (dbError) {
      console.error("Database Update Error:", dbError);
      throw new Error("Database update failed: " + dbError.message);
    }

    // 3. SUCCESS - UI Update
    toast.success("Updated Successfully!");
    setExpenses(prev => prev.map(e => e.id === entryId ? { 
      ...e, 
      description: editValues.description, 
      amount: parseFloat(editValues.amount) || 0,
      image_url: finalImageUrl 
    } : e));
    
    // States Cleanup
    setEditingRow(null);
    setSelectedFile(prev => ({ ...prev, [entryId]: null }));
    setLocalPreview(prev => ({ ...prev, [entryId]: null }));

  } catch (err: any) {
    console.error("Final Catch Error:", err);
    toast.error(err.message || "An error occurred");
  } finally {
    setSavingId(null);
  }
};

  const handleImageUpload = async (entryId: string, file: File) => {
    setUploadingId(entryId);
    const fileName = `${userId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from("expense-receipts").upload(fileName, file);

    if (error) {
      toast.error("Upload failed");
      setUploadingId(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("expense-receipts").getPublicUrl(data.path);
    const { error: updateError } = await supabase.from("expenses").update({ image_url: urlData.publicUrl }).eq("id", entryId);

    if (updateError) {
      toast.error("Failed to save image URL");
    } else {
      toast.success("Image uploaded!");
      setExpenses(prev => prev.map(e => e.id === entryId ? { ...e, image_url: urlData.publicUrl } : e));
    }
    setUploadingId(null);
  };

  const renderExpenseEntry = (entry: Expense, editable: boolean) => {
  const isDetailOpen = expandedEntry === entry.id;
  const isApproved = entry.status === "approved" || entry.status === "settled";
  
  // Nayi select ki hui image pehle dikhao, warna database waali
  const currentImageToShow = localPreview[entry.id] || entry.image_url;

  return (
    <div key={entry.id} className="border-t border-border/10 first:border-t-0">
      {/* --- LAYER 3 HEADER --- */}
      <button
        onClick={() => setExpandedEntry(isDetailOpen ? null : entry.id)}
        className="w-full py-3 flex justify-between items-center hover:bg-white/40 text-left px-1"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CATEGORY_DOT_COLORS[entry.category] || "bg-muted-foreground"}`} />
          <span className="text-[10px] font-bold text-foreground truncate uppercase">{entry.description || "No Detail"}</span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className={`text-[10px] font-black ${entry.category === "cash" ? "text-success" : "text-foreground/80"}`}>
            ₹{Number(entry.amount).toLocaleString()}
          </span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isDetailOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* --- LAYER 3 CONTENT --- */}
      {isDetailOpen && (
        <div className="pb-3 px-1">
          {editingRow === entry.id && editable && !isApproved ? (
            /* --- EDIT MODE --- */
            <div className="bg-card p-3 rounded-xl border border-primary/20 space-y-3 shadow-inner">
              <div className="flex gap-3">
                {/* Image Selector with Local Preview */}
                <div className="relative">
                  <label className="relative w-16 h-16 rounded-lg bg-secondary/50 border border-dashed border-border flex flex-col items-center justify-center cursor-pointer overflow-hidden group">
                    {currentImageToShow ? (
                      <img src={currentImageToShow} className="w-full h-full object-cover" alt="Selected" />
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-muted-foreground/40" />
                        <span className="text-[7px] font-black text-muted-foreground/60 uppercase">Add</span>
                      </>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] text-white font-black uppercase">Change</span>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={e => e.target.files?.[0] && handleFileSelect(entry.id, e.target.files[0])} 
                    />
                  </label>
                  
                  {/* Delete Image Button (X) */}
                  {currentImageToShow && (
                    <button 
                      type="button"
                      onClick={() => {
                        setLocalPreview(prev => ({ ...prev, [entry.id]: null }));
                        setSelectedFile(prev => ({ ...prev, [entry.id]: null }));
                        // Note: Agar aapko database se image null karni hai turant, toh yahan ek confirm() daal sakte hain
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 shadow-lg border-2 border-card"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    value={editValues.description}
                    onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                    className="w-full text-[11px] font-bold bg-secondary/50 p-2 rounded-lg border border-border outline-none focus:border-primary"
                    placeholder="Description"
                  />
                  <div className="flex items-center bg-secondary/50 p-2 rounded-lg border border-border">
                    <span className="text-[10px] font-black text-muted-foreground mr-1">₹</span>
                    <input
                      type="number"
                      value={editValues.amount}
                      onChange={e => setEditValues(v => ({ ...v, amount: e.target.value }))}
                      className="w-full bg-transparent text-[11px] font-black outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => saveEdit(entry.id)} 
                  disabled={savingId === entry.id}
                  className="flex-1 bg-primary text-white py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {savingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save Changes
                </button>
                <button 
                  onClick={() => {
                    setEditingRow(null);
                    setLocalPreview(prev => ({ ...prev, [entry.id]: null }));
                    setSelectedFile(prev => ({ ...prev, [entry.id]: null }));
                  }} 
                  className="px-4 bg-secondary text-muted-foreground rounded-lg text-[10px] font-black uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* --- VIEW MODE --- */
            <div className="bg-white p-2.5 rounded-xl border border-border/50 flex gap-3 shadow-sm">
              <div className="relative flex-shrink-0">
                {entry.image_url ? (
                  <div className="relative w-14 h-14">
                    <img src={entry.image_url} className="w-full h-full rounded-lg object-cover border" alt="receipt" />
                    <button 
                      onClick={() => setPreviewImage(entry.image_url)} 
                      className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <Eye className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-secondary/50 flex flex-col items-center justify-center border border-dashed border-border/60">
                    <Camera className="w-4 h-4 text-muted-foreground/30" />
                    <span className="text-[6px] font-bold text-muted-foreground/40 mt-1">NO IMAGE</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div className="flex justify-between items-start">
                  <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase ${STATUS_BADGES[entry.status]}`}>
                    {entry.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-muted-foreground uppercase">{entry.category}</span>
                    {isApproved && <LockKeyhole className="w-2.5 h-2.5 text-success/60" />}
                    {entry.image_url && (
                       <button onClick={() => setPreviewImage(entry.image_url)} className="p-1 bg-primary/10 rounded-md">
                         <Eye className="w-3 h-3 text-primary" />
                       </button>
                    )}
                  </div>
                </div>
                
                {entry.rejected_reason && (
                  <p className="text-[8px] text-destructive font-bold italic mt-1 leading-tight">⚠ {entry.rejected_reason}</p>
                )}

                <div className="flex justify-between items-end mt-2">
                  <p className="text-[9px] text-muted-foreground font-medium italic">
                    {isApproved ? "Verification Complete" : "Pending Review"}
                  </p>
                  {editable && !isApproved && (
                    <button 
                      onClick={() => startEdit(entry)} 
                      className="text-[9px] font-black text-primary underline active:opacity-50"
                    >
                      Edit Entry
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

  // Active missions: show dates expanded inline (no mission-level accordion needed)
  const renderActiveMission = (mission: Mission) => {
    const missionExpenses = getExpensesForMission(mission.id);
    const dateGroups = groupByDate(missionExpenses);
    const missionTotal = missionExpenses.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
    const cashTotal = missionExpenses.filter(e => e.category === "cash").reduce((s, e) => s + Number(e.amount), 0);

    return (
      <div key={mission.id} className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in mb-3">
        <div className="p-4 bg-primary/5 border-b border-border">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-black text-foreground uppercase tracking-tight">{mission.name}</h4>
              <p className="text-[9px] text-muted-foreground font-bold mt-0.5">
                {new Date(mission.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}{mission.end_date ? ` → ${new Date(mission.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}` : " → Ongoing"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-destructive">₹{missionTotal.toLocaleString()}</p>
              {cashTotal > 0 && <p className="text-[9px] font-bold text-success">+₹{cashTotal.toLocaleString()} cash</p>}
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            <span className="text-[8px] bg-secondary px-2 py-0.5 rounded-full font-black text-muted-foreground">{missionExpenses.length} entries</span>
            <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-success/15 text-success">{mission.status}</span>
          </div>
        </div>

        <div className="divide-y divide-border">
          {dateGroups.length === 0 && (
            <p className="text-center text-muted-foreground text-[10px] italic py-6">No entries yet</p>
          )}
          {dateGroups.map(([date, entries]) => {
            const dateKey = `${mission.id}_${date}`;
            const isOpen = expandedDates.has(dateKey);
            const dayTotal = entries.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);

            return (
              <div key={dateKey}>
                <button onClick={() => toggleDate(dateKey)} className="w-full px-4 py-3 flex justify-between items-center hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-tighter">{new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</span>
                    <span className="text-[8px] bg-secondary px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">{entries.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-foreground">₹{dayTotal.toLocaleString()}</span>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {entries.map(entry => renderExpenseEntry(entry, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Old missions: Level 1 = mission accordion, Level 2 = date accordion, Level 3 = entries
  const renderOldMission = (mission: Mission) => {
    const missionExpenses = getExpensesForMission(mission.id);
    const dateGroups = groupByDate(missionExpenses);
    const missionTotal = missionExpenses.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
    const cashTotal = missionExpenses.filter(e => e.category === "cash").reduce((s, e) => s + Number(e.amount), 0);
    const isMissionOpen = expandedMissions.has(mission.id);

    return (
      <div key={mission.id} className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in mb-3">
        {/* Level 1: Mission Header (clickable) */}
        <button
          onClick={() => toggleMission(mission.id)}
          className="w-full p-4 bg-muted/30 border-b border-border text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {isMissionOpen ? (
                <ChevronDown className="w-4 h-4 text-primary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <h4 className="text-xs font-black text-foreground uppercase tracking-tight">{mission.name}</h4>
                <p className="text-[9px] text-muted-foreground font-bold mt-0.5">
                  {new Date(mission.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}{mission.end_date ? ` → ${new Date(mission.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-destructive">₹{missionTotal.toLocaleString()}</p>
              {cashTotal > 0 && <p className="text-[9px] font-bold text-success">+₹{cashTotal.toLocaleString()}</p>}
              <span className="text-[8px] bg-secondary px-2 py-0.5 rounded-full font-black text-muted-foreground">{missionExpenses.length} entries</span>
            </div>
          </div>
        </button>

        {/* Level 2: Date list (shown when mission expanded) */}
        {isMissionOpen && (
          <div className="divide-y divide-border">
            {dateGroups.length === 0 && (
              <p className="text-center text-muted-foreground text-[10px] italic py-6">No entries in this mission</p>
            )}
            {dateGroups.map(([date, entries]) => {
              const dateKey = `old_${mission.id}_${date}`;
              const isDateOpen = expandedDates.has(dateKey);
              const dayTotal = entries.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
              const dayCash = entries.filter(e => e.category === "cash").reduce((s, e) => s + Number(e.amount), 0);

              return (
                <div key={dateKey}>
                  <button
                    onClick={() => toggleDate(dateKey)}
                    className="w-full px-5 py-3 flex justify-between items-center hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isDateOpen ? (
                        <ChevronDown className="w-3 h-3 text-primary" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className="text-[9px] font-black text-primary uppercase tracking-tighter">
                        {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </span>
                      <span className="text-[8px] bg-secondary px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">
                        {entries.length} entries
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-foreground">₹{dayTotal.toLocaleString()}</span>
                      {dayCash > 0 && <span className="text-[9px] font-bold text-success">+₹{dayCash.toLocaleString()}</span>}
                    </div>
                  </button>

                  {/* Level 3: Expense entries (shown when date expanded) */}
                  {isDateOpen && (
                    <div className="px-4 pb-3 space-y-2">
                      {entries.map(entry => renderExpenseEntry(entry, false))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (missions.length === 0) {
    return (
      <div className="mt-8 text-center py-10">
        <p className="text-muted-foreground text-xs italic">No missions found. Start a mission to begin logging expenses.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-3 px-2">
        <h3 className="font-black text-foreground uppercase text-[10px] tracking-widest">Journey Logbook</h3>
        <span className="text-[9px] bg-secondary px-2 py-0.5 rounded-full font-bold text-muted-foreground">
          {expenses.length} Logs
        </span>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full bg-secondary/50 rounded-xl p-1 h-auto">
          <TabsTrigger
            value="active"
            className="flex-1 text-[9px] font-black uppercase tracking-wider rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Active ({activeMissions.length})
          </TabsTrigger>
          <TabsTrigger
            value="old"
            className="flex-1 text-[9px] font-black uppercase tracking-wider rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Old Missions ({oldMissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-3 space-y-3">
          {activeMissions.length === 0 ? (
            <p className="text-center text-muted-foreground text-[10px] italic py-6">No active missions</p>
          ) : (
            activeMissions.map(m => renderActiveMission(m))
          )}
        </TabsContent>

        <TabsContent value="old" className="mt-3 space-y-3">
          {oldMissions.length === 0 ? (
            <p className="text-center text-muted-foreground text-[10px] italic py-6">No completed missions</p>
          ) : (
            oldMissions.map(m => renderOldMission(m))
          )}
        </TabsContent>
      </Tabs>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
