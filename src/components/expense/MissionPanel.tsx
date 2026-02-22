import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Loader2 } from "lucide-react";

interface Props {
  activeMission: any;
  userId: string;
  onMissionChange: () => void;
}

export default function MissionPanel({ activeMission, userId, onMissionChange }: Props) {
  const [missionName, setMissionName] = useState("");
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [missionStats, setMissionStats] = useState({ expense: 0, received: 0 });

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

  const startMission = async () => {
    if (!missionName.trim()) {
      toast.error("Enter a mission name!");
      return;
    }
    setStarting(true);
    const { error } = await supabase.from("missions").insert({
      user_id: userId,
      name: missionName.trim(),
      status: "active",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Mission started!");
      setMissionName("");
      onMissionChange();
    }
    setStarting(false);
  };

  const finishMission = async () => {
    if (!activeMission) return;
    if (!confirm("Finish this mission and archive?")) return;
    setFinishing(true);
    const { error } = await supabase
      .from("missions")
      .update({ status: "completed", end_date: new Date().toISOString().split("T")[0] })
      .eq("id", activeMission.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Mission completed!");
      onMissionChange();
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
          placeholder="Mission Name"
          value={missionName}
          onChange={e => setMissionName(e.target.value)}
          className="w-full p-2.5 rounded-xl bg-card text-foreground outline-none text-[10px] font-bold border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
        />
        <MapPin className="absolute right-3 top-3 w-3 h-3 text-muted-foreground" />
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
