import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Loader2, Camera, X, Users, FileText } from "lucide-react";

interface Props {
  activeMission: any;
  userId: string;
  onMissionChange: () => void;
}

export default function MissionPanel({ activeMission, userId, onMissionChange }: Props) {
  const [missionName, setMissionName] = useState("");
  const [missionAddress, setMissionAddress] = useState("");
  const [missionWith, setMissionWith] = useState("");
  const [missionDetails, setMissionDetails] = useState("");
  const [missionPhotos, setMissionPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [missionStats, setMissionStats] = useState({ expense: 0, received: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeMission || !userId) {
      setMissionStats({ expense: 0, received: 0 });
      return;
    }

    const fetchStats = async () => {
      const [expRes, setRes] = await Promise.all([
        supabase.from("expenses").select("amount, category, status")
          .eq("mission_id", activeMission.id).eq("user_id", userId),
        supabase.from("settlements").select("amount")
          .eq("mission_id", activeMission.id).eq("user_id", userId),
      ]);

      const expense = (expRes.data || [])
        .filter(e => e.category !== "cash" && e.status === "approved")
        .reduce((s, e) => s + Number(e.amount), 0);
      const received = (setRes.data || []).reduce((s, e) => s + Number(e.amount), 0);
      setMissionStats({ expense, received });
    };

    fetchStats();
  }, [activeMission, userId]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalAllowed = 4 - missionPhotos.length;
    if (files.length > totalAllowed) {
      toast.error(`You can upload max ${4 - missionPhotos.length} more photos`);
      return;
    }
    const newPhotos = [...missionPhotos, ...files.slice(0, totalAllowed)];
    setMissionPhotos(newPhotos);
    const newPreviews = files.slice(0, totalAllowed).map(f => URL.createObjectURL(f));
    setPhotoPreviewUrls(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setMissionPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const startMission = async () => {
    if (!missionName.trim()) {
      toast.error("Enter a mission name!");
      return;
    }
    if (!missionAddress.trim()) {
      toast.error("Enter a mission address!");
      return;
    }
    if (!missionWith.trim()) {
      toast.error("Enter mission with (person/team)!");
      return;
    }
    if (!missionDetails.trim()) {
      toast.error("Enter mission details!");
      return;
    }

    setStarting(true);
    try {
      const { data: missionData, error } = await supabase.from("missions").insert({
        user_id: userId,
        name: missionName.trim(),
        address: missionAddress.trim(),
        mission_with: missionWith.trim(),
        details: missionDetails.trim(),
        status: "active",
      }).select().single();

      if (error) throw error;

      // Upload photos if any
      if (missionPhotos.length > 0 && missionData) {
        for (const file of missionPhotos) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${userId}/${missionData.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('mission-photos')
            .upload(fileName, file);
          
          if (uploadError) {
            console.error("Photo upload error:", uploadError);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from('mission-photos')
            .getPublicUrl(fileName);

          await supabase.from("mission_photos" as any).insert({
            mission_id: missionData.id,
            user_id: userId,
            image_url: urlData.publicUrl,
          });
        }
      }

      toast.success("Mission started!");
      setMissionName("");
      setMissionAddress("");
      setMissionWith("");
      setMissionDetails("");
      setMissionPhotos([]);
      setPhotoPreviewUrls([]);
      onMissionChange();
    } catch (err: any) {
      toast.error(err.message);
    }
    setStarting(false);
  };

  const finishMission = async () => {
    if (!activeMission) return;
    if (!confirm("Finish this mission and archive?")) return;
    setFinishing(true);
    try {
      const { error } = await supabase
        .from("missions")
        .update({ status: "completed", end_date: new Date().toISOString().split("T")[0] })
        .eq("id", activeMission.id)
        .eq("user_id", userId);
      if (error) throw error;
      toast.success("Mission completed successfully.");
      onMissionChange();
    } catch (err: any) {
      console.error("Mission finish error:", err);
      toast.error("Unable to complete mission. Please try again.");
    }
    setFinishing(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  };

  if (activeMission) {
    const balance = missionStats.received - missionStats.expense;
    return (
      <div className="bg-primary-foreground/10 p-4 rounded-2xl backdrop-blur-md border border-primary-foreground/20">
        <p className="text-primary-foreground/60 text-[10px] italic uppercase tracking-widest">Active Mission</p>
        <h2 className="text-lg font-black leading-tight uppercase italic text-primary-foreground">
          {activeMission.name}
        </h2>
        {activeMission.address && (
          <p className="text-[9px] text-primary-foreground/50 font-bold mt-0.5 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" /> {activeMission.address}
          </p>
        )}
        {activeMission.mission_with && (
          <p className="text-[9px] text-primary-foreground/50 font-bold flex items-center gap-1">
            <Users className="w-2.5 h-2.5" /> {activeMission.mission_with}
          </p>
        )}
        <p className="text-[10px] text-primary-foreground/60 font-bold mt-1">
          Started: {formatDate(activeMission.start_date)}
        </p>

        {/* Live Mission Summary */}
        <div className="flex gap-4 mt-3 pt-2 border-t border-primary-foreground/10">
          <div className="flex flex-col">
            <span className="text-[7px] text-primary-foreground/40 font-black uppercase">Expense</span>
            <span className="text-[11px] font-black text-primary-foreground">₹{missionStats.expense.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] text-primary-foreground/40 font-black uppercase">Received</span>
            <span className="text-[11px] font-black text-primary-foreground">₹{missionStats.received.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] text-primary-foreground/40 font-black uppercase">Balance</span>
            <span className={`text-[11px] font-black ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₹{balance.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          onClick={finishMission}
          disabled={finishing}
          className="mt-3 bg-destructive px-4 py-2 rounded-lg text-destructive-foreground text-[9px] font-black uppercase tracking-widest active:scale-95 shadow-lg transition-all disabled:opacity-50"
        >
          {finishing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Finish"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-secondary p-3 rounded-2xl border border-border shadow-sm space-y-2">
      <div className="relative">
        <input
          type="text"
          placeholder="Mission Name *"
          value={missionName}
          onChange={e => setMissionName(e.target.value)}
          className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
        />
        <MapPin className="absolute right-3 top-3 w-3 h-3 text-muted-foreground" />
      </div>
      <input
        type="text"
        placeholder="Mission Address *"
        value={missionAddress}
        onChange={e => setMissionAddress(e.target.value)}
        className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
      />
      <input
        type="text"
        placeholder="Mission With (Person/Team) *"
        value={missionWith}
        onChange={e => setMissionWith(e.target.value)}
        className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
      />
      <textarea
        placeholder="Mission Details *"
        value={missionDetails}
        onChange={e => setMissionDetails(e.target.value)}
        rows={2}
        className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground resize-none"
      />

      {/* Photo Upload */}
      <div className="flex gap-2 flex-wrap">
        {photoPreviewUrls.map((url, i) => (
          <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-border">
            <img src={url} className="w-full h-full object-cover" alt="" />
            <button onClick={() => removePhoto(i)} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 shadow">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {missionPhotos.length < 4 && (
          <label className="w-12 h-12 rounded-lg bg-card border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/50 transition-all">
            <Camera className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[6px] font-bold text-muted-foreground/50">Add</span>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoSelect} />
          </label>
        )}
      </div>

      <button
        onClick={startMission}
        disabled={starting}
        className="w-full bg-primary text-primary-foreground font-black px-5 py-2.5 rounded-xl shadow-lg uppercase text-[9px] tracking-widest active:scale-95 transition-all disabled:opacity-50"
      >
        {starting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "START MISSION"}
      </button>
    </div>
  );
}
