import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Loader2, Camera, X, Users, FileText, Plus, ChevronDown, ChevronRight, Pencil, CheckCircle } from "lucide-react";

interface Mission {
  id: string;
  name: string;
  address: string;
  mission_with: string;
  details: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

interface Props {
  activeMission: any; // kept for backward compat, not used now
  userId: string;
  onMissionChange: () => void;
}

const emptyForm = { name: "", address: "", mission_with: "", details: "" };

export default function MissionPanel({ userId, onMissionChange }: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [missionPhotos, setMissionPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  // Finish confirm
  const [finishingId, setFinishingId] = useState<string | null>(null);

  // Expanded mission
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stats per mission
  const [statsMap, setStatsMap] = useState<Record<string, { expense: number; received: number }>>({});

  const fetchMissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("missions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setMissions(data || []);
    setLoading(false);
  };

  const fetchStats = async (missionList: Mission[]) => {
    const map: Record<string, { expense: number; received: number }> = {};
    await Promise.all(missionList.map(async (m) => {
      const [expRes, setRes] = await Promise.all([
        supabase.from("expenses").select("amount, category, status").eq("mission_id", m.id).eq("user_id", userId),
        supabase.from("settlements" as any).select("amount").eq("mission_id", m.id).eq("user_id", userId),
      ]);
      const expense = (expRes.data || []).filter((e: any) => e.category !== "cash" && e.status === "approved").reduce((s: number, e: any) => s + Number(e.amount), 0);
      const received = ((setRes as any).data || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
      map[m.id] = { expense, received };
    }));
    setStatsMap(map);
  };

  useEffect(() => {
    if (!userId) return;
    fetchMissions();
  }, [userId]);

  useEffect(() => {
    if (missions.length > 0) fetchStats(missions);
  }, [missions]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = 4 - missionPhotos.length;
    const newPhotos = [...missionPhotos, ...files.slice(0, allowed)];
    setMissionPhotos(newPhotos);
    setPhotoPreviewUrls(prev => [...prev, ...files.slice(0, allowed).map(f => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhotos = async (missionId: string) => {
    for (const file of missionPhotos) {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${missionId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
      const { error } = await supabase.storage.from('mission-photos').upload(path, file);
      if (error) continue;
      const { data: urlData } = supabase.storage.from('mission-photos').getPublicUrl(path);
      await supabase.from("mission_photos" as any).insert({ mission_id: missionId, user_id: userId, image_url: urlData.publicUrl });
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error("Mission name required!");
    if (!form.address.trim()) return toast.error("Address required!");
    if (!form.mission_with.trim()) return toast.error("Mission with required!");
    if (!form.details.trim()) return toast.error("Details required!");
    setSaving(true);
    try {
      const { data, error } = await supabase.from("missions").insert({
        user_id: userId, name: form.name.trim(), address: form.address.trim(),
        mission_with: form.mission_with.trim(), details: form.details.trim(), status: "active",
      }).select().single();
      if (error) throw error;
      if (missionPhotos.length > 0) await uploadPhotos(data.id);
      toast.success("Mission started!");
      setForm(emptyForm); setMissionPhotos([]); setPhotoPreviewUrls([]);
      setShowCreate(false);
      await fetchMissions();
      onMissionChange();
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editId) return;
    if (!editForm.name.trim()) return toast.error("Name required!");
    setEditSaving(true);
    try {
      const { error } = await supabase.from("missions").update({
        name: editForm.name.trim(), address: editForm.address.trim(),
        mission_with: editForm.mission_with.trim(), details: editForm.details.trim(),
      }).eq("id", editId);
      if (error) throw error;
      toast.success("Mission updated!");
      setEditId(null);
      await fetchMissions();
      onMissionChange();
    } catch (err: any) { toast.error(err.message); }
    setEditSaving(false);
  };

  const handleFinish = async (id: string) => {
    setFinishingId(id);
    try {
      const { error } = await supabase.from("missions").update({
        status: "completed", end_date: new Date().toISOString().split("T")[0]
      }).eq("id", id);
      if (error) throw error;
      toast.success("Mission completed!");
      await fetchMissions();
      onMissionChange();
    } catch (err: any) { toast.error(err.message); }
    setFinishingId(null);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  const activeMissions = missions.filter(m => m.status === "active" || m.status === "pending");
  const oldMissions = missions.filter(m => m.status === "completed");

  const MissionCard = ({ m }: { m: Mission }) => {
    const isActive = m.status === "active" || m.status === "pending";
    const stats = statsMap[m.id] || { expense: 0, received: 0 };
    const balance = stats.received - stats.expense;
    const isExpanded = expandedId === m.id;
    const isEditing = editId === m.id;

    return (
      <div className={`rounded-2xl border overflow-hidden transition-all ${isActive ? "bg-primary-foreground/10 border-primary-foreground/20" : "bg-secondary/40 border-border"}`}>
        {/* Header */}
        <button className="w-full flex items-center justify-between px-3.5 py-3 text-left"
          onClick={() => setExpandedId(isExpanded ? null : m.id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-green-400 animate-pulse" : "bg-muted-foreground/40"}`} />
              <p className={`text-[11px] font-black uppercase truncate ${isActive ? "text-primary-foreground" : "text-foreground"}`}>{m.name}</p>
            </div>
            <p className={`text-[8px] font-bold mt-0.5 ml-3.5 ${isActive ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
              {formatDate(m.start_date)}{m.end_date ? ` → ${formatDate(m.end_date)}` : " → Ongoing"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-black ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
              ₹{stats.expense.toLocaleString()}
            </span>
            {isExpanded ? <ChevronDown className={`w-3.5 h-3.5 ${isActive ? "text-primary-foreground/60" : "text-muted-foreground"}`} />
              : <ChevronRight className={`w-3.5 h-3.5 ${isActive ? "text-primary-foreground/60" : "text-muted-foreground"}`} />}
          </div>
        </button>

        {/* Expanded */}
        {isExpanded && (
          <div className={`border-t px-3.5 py-3 space-y-3 ${isActive ? "border-primary-foreground/10" : "border-border"}`}>

            {/* Edit form */}
            {isEditing ? (
              <div className="space-y-2">
                {[
                  { ph: "Mission Name *", val: editForm.name, key: "name" },
                  { ph: "Address", val: editForm.address, key: "address" },
                  { ph: "Mission With", val: editForm.mission_with, key: "mission_with" },
                ].map(f => (
                  <input key={f.key} type="text" placeholder={f.ph} value={f.val}
                    onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary" />
                ))}
                <textarea placeholder="Details" value={editForm.details} rows={2}
                  onChange={e => setEditForm(prev => ({ ...prev, details: e.target.value }))}
                  className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary resize-none" />
                <div className="flex gap-2">
                  <button onClick={handleEdit} disabled={editSaving}
                    className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">
                    {editSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Save"}
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="flex-1 py-2 bg-secondary text-muted-foreground rounded-xl text-[8px] font-black uppercase">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Info */}
                <div className="space-y-1">
                  {m.address && <p className={`text-[9px] font-medium flex items-center gap-1 ${isActive ? "text-primary-foreground/60" : "text-muted-foreground"}`}><MapPin className="w-2.5 h-2.5 flex-shrink-0" />{m.address}</p>}
                  {m.mission_with && <p className={`text-[9px] font-medium flex items-center gap-1 ${isActive ? "text-primary-foreground/60" : "text-muted-foreground"}`}><Users className="w-2.5 h-2.5 flex-shrink-0" />{m.mission_with}</p>}
                  {m.details && <p className={`text-[9px] font-medium flex items-center gap-1 ${isActive ? "text-primary-foreground/60" : "text-muted-foreground"}`}><FileText className="w-2.5 h-2.5 flex-shrink-0" />{m.details}</p>}
                </div>

                {/* Stats */}
                <div className={`flex gap-4 pt-2 border-t ${isActive ? "border-primary-foreground/10" : "border-border"}`}>
                  {[
                    { label: "Expense", val: stats.expense, color: isActive ? "text-primary-foreground" : "text-foreground" },
                    { label: "Received", val: stats.received, color: isActive ? "text-primary-foreground" : "text-foreground" },
                    { label: "Balance", val: Math.abs(balance), color: balance >= 0 ? "text-green-400" : "text-red-400" },
                  ].map(s => (
                    <div key={s.label}>
                      <p className={`text-[7px] font-black uppercase ${isActive ? "text-primary-foreground/40" : "text-muted-foreground"}`}>{s.label}</p>
                      <p className={`text-[11px] font-black ${s.color}`}>{balance < 0 && s.label === "Balance" ? "-" : ""}₹{s.val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                {isActive && (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditId(m.id); setEditForm({ name: m.name, address: m.address || "", mission_with: m.mission_with || "", details: m.details || "" }); }}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary-foreground/10 text-primary-foreground rounded-xl text-[8px] font-black uppercase border border-primary-foreground/20 active:scale-95 transition-all">
                      <Pencil className="w-2.5 h-2.5" /> Edit
                    </button>
                    <button onClick={() => handleFinish(m.id)} disabled={finishingId === m.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-destructive text-destructive-foreground rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all disabled:opacity-50">
                      {finishingId === m.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <><CheckCircle className="w-2.5 h-2.5" /> Finish</>}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">

      {/* Active missions */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary-foreground/40" /></div>
      ) : (
        <>
          {activeMissions.length > 0 && (
            <div className="space-y-2">
              {activeMissions.map(m => <MissionCard key={m.id} m={m} />)}
            </div>
          )}

          {oldMissions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[7px] font-black uppercase text-primary-foreground/30 tracking-widest px-1">Completed</p>
              {oldMissions.map(m => <MissionCard key={m.id} m={m} />)}
            </div>
          )}

          {missions.length === 0 && !showCreate && (
            <p className="text-[9px] text-primary-foreground/40 text-center py-2 font-bold italic">No missions yet</p>
          )}
        </>
      )}

      {/* Create new mission */}
      {showCreate ? (
        <div className="bg-secondary/50 p-3 rounded-2xl border border-border space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-foreground">New Mission</p>
            <button onClick={() => { setShowCreate(false); setForm(emptyForm); setMissionPhotos([]); setPhotoPreviewUrls([]); }}
              className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          {[
            { ph: "Mission Name *", val: form.name, key: "name" },
            { ph: "Address *", val: form.address, key: "address" },
            { ph: "Mission With *", val: form.mission_with, key: "mission_with" },
          ].map(f => (
            <input key={f.key} type="text" placeholder={f.ph} value={f.val}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground" />
          ))}
          <textarea placeholder="Mission Details *" value={form.details} rows={2}
            onChange={e => setForm(prev => ({ ...prev, details: e.target.value }))}
            className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary resize-none placeholder:text-muted-foreground" />

          {/* Photos */}
          <div className="flex gap-2 flex-wrap">
            {photoPreviewUrls.map((url, i) => (
              <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-border">
                <img src={url} className="w-full h-full object-cover" alt="" />
                <button onClick={() => { setMissionPhotos(p => p.filter((_, j) => j !== i)); setPhotoPreviewUrls(p => p.filter((_, j) => j !== i)); }}
                  className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {missionPhotos.length < 4 && (
              <label className="w-12 h-12 rounded-lg bg-card border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/50">
                <Camera className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[6px] font-bold text-muted-foreground/50">Add</span>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoSelect} />
              </label>
            )}
          </div>

          <button onClick={handleCreate} disabled={saving}
            className="w-full bg-primary text-primary-foreground font-black px-5 py-2.5 rounded-xl shadow-lg uppercase text-[9px] tracking-widest active:scale-95 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "START MISSION"}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-foreground/10 text-primary-foreground rounded-xl text-[9px] font-black uppercase border border-primary-foreground/20 active:scale-95 transition-all hover:bg-primary-foreground/15">
          <Plus className="w-3.5 h-3.5" /> New Mission
        </button>
      )}
    </div>
  );
}