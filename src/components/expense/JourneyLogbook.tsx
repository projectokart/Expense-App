import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, Camera, Eye, CloudUpload, Loader2, Save, Image } from "lucide-react";
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
  const [missions, setMissions] = useState<Mission[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
    setSavingId(entryId);
    const { error } = await supabase.from("expenses").update({
      description: editValues.description,
      amount: parseFloat(editValues.amount) || 0,
    }).eq("id", entryId);

    if (error) {
      toast.error("Update failed");
    } else {
      toast.success("Updated!");
      setExpenses(prev => prev.map(e => e.id === entryId ? { ...e, description: editValues.description, amount: parseFloat(editValues.amount) || 0 } : e));
      setEditingRow(null);
    }
    setSavingId(null);
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

  const renderMissionBlock = (mission: Mission, editable: boolean) => {
    const missionExpenses = getExpensesForMission(mission.id);
    const dateGroups = groupByDate(missionExpenses);
    const missionTotal = missionExpenses.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
    const cashTotal = missionExpenses.filter(e => e.category === "cash").reduce((s, e) => s + Number(e.amount), 0);

    return (
      <div key={mission.id} className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in mb-3">
        {/* Mission Header */}
        <div className="p-4 bg-primary/5 border-b border-border">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-black text-foreground uppercase tracking-tight">{mission.name}</h4>
              <p className="text-[9px] text-muted-foreground font-bold mt-0.5">
                {mission.start_date}{mission.end_date ? ` → ${mission.end_date}` : " → Ongoing"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-destructive">₹{missionTotal.toLocaleString()}</p>
              {cashTotal > 0 && <p className="text-[9px] font-bold text-success">+₹{cashTotal.toLocaleString()} cash</p>}
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            <span className="text-[8px] bg-secondary px-2 py-0.5 rounded-full font-black text-muted-foreground">
              {missionExpenses.length} entries
            </span>
            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${
              editable ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            }`}>
              {mission.status}
            </span>
          </div>
        </div>

        {/* Date Groups */}
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
                <button
                  onClick={() => toggleDate(dateKey)}
                  className="w-full px-4 py-3 flex justify-between items-center hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-tighter">{date}</span>
                    <span className="text-[8px] bg-secondary px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">
                      {entries.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-foreground">₹{dayTotal.toLocaleString()}</span>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {entries.map(entry => (
                      <div key={entry.id} className="bg-secondary/30 rounded-xl p-3 animate-fade-in border border-border/50">
                        {editingRow === entry.id && editable ? (
                          /* Editing Mode */
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2 h-2 rounded-full ${CATEGORY_DOT_COLORS[entry.category] || "bg-muted-foreground"}`} />
                              <span className="text-[9px] font-black text-muted-foreground uppercase">{entry.category}</span>
                            </div>
                            <input
                              value={editValues.description}
                              onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                              className="w-full text-[11px] font-bold bg-card p-2 rounded-lg border border-border outline-none focus:border-primary text-foreground"
                              placeholder="Description"
                            />
                            <div className="flex items-center gap-2">
                              <div className="flex-1 flex items-center bg-card px-2 py-1.5 rounded-lg border border-border">
                                <span className="text-[10px] font-black text-primary/60 mr-1">₹</span>
                                <input
                                  type="number"
                                  value={editValues.amount}
                                  onChange={e => setEditValues(v => ({ ...v, amount: e.target.value }))}
                                  className="w-full bg-transparent font-black text-[11px] outline-none text-right text-primary"
                                />
                              </div>
                              <button
                                onClick={() => saveEdit(entry.id)}
                                disabled={savingId === entry.id}
                                className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[9px] font-black uppercase flex items-center gap-1"
                              >
                                {savingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save
                              </button>
                              <button
                                onClick={() => setEditingRow(null)}
                                className="h-8 px-2 rounded-lg bg-secondary text-muted-foreground text-[9px] font-black"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_DOT_COLORS[entry.category] || "bg-muted-foreground"}`} />
                                <span className="text-[9px] font-black text-muted-foreground uppercase flex-shrink-0">{entry.category}</span>
                                <span className="text-[10px] font-bold text-foreground truncate">{entry.description}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${STATUS_BADGES[entry.status] || ""}`}>
                                  {entry.status}
                                </span>
                                <span className={`text-[11px] font-black ${entry.category === "cash" ? "text-success" : "text-destructive"}`}>
                                  {entry.category === "cash" ? "+" : "-"}₹{Number(entry.amount).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {entry.rejected_reason && (
                              <p className="text-[8px] text-destructive mt-1 pl-4 italic">Reason: {entry.rejected_reason}</p>
                            )}

                            {/* Image & Actions Row */}
                            <div className="flex items-center gap-2 mt-2 pl-4">
                              {entry.image_url && (
                                <>
                                  <button
                                    onClick={() => setPreviewImage(entry.image_url)}
                                    className="w-7 h-7 rounded-lg overflow-hidden border border-border relative"
                                  >
                                    <img src={entry.image_url} className="w-full h-full object-cover" alt="" />
                                  </button>
                                  <button
                                    onClick={() => setPreviewImage(entry.image_url)}
                                    className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </>
                              )}

                              {editable && !entry.image_url && (
                                <label className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                                  {uploadingId === entry.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                  ) : (
                                    <Camera className="w-3 h-3 text-muted-foreground" />
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => e.target.files?.[0] && handleImageUpload(entry.id, e.target.files[0])}
                                  />
                                </label>
                              )}

                              {editable && entry.status === "pending" && (
                                <button
                                  onClick={() => startEdit(entry)}
                                  className="text-[8px] font-black text-primary underline ml-auto"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
            activeMissions.map(m => renderMissionBlock(m, true))
          )}
        </TabsContent>

        <TabsContent value="old" className="mt-3 space-y-3">
          {oldMissions.length === 0 ? (
            <p className="text-center text-muted-foreground text-[10px] italic py-6">No completed missions</p>
          ) : (
            oldMissions.map(m => renderMissionBlock(m, false))
          )}
        </TabsContent>
      </Tabs>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
