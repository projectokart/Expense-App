import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Car, Utensils, Hotel, Briefcase, Luggage, Settings2, ShieldCheck } from "lucide-react";

interface Props {
  limits: any[];
  currentUserId: string;
  onRefresh: () => void;
}

export default function LimitsTab({ limits, currentUserId, onRefresh }: Props) {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  // Local state for toggle — instant UI update
  const [localLimits, setLocalLimits] = useState<any[]>(limits);

  // Sync when parent data changes
  useState(() => { setLocalLimits(limits); });

  const updateLimit = async (id: string, newLimit: number) => {
    setIsUpdating(id);
    // Optimistic local update
    setLocalLimits(prev => prev.map(l => l.id === id ? { ...l, daily_limit: newLimit } : l));
    try {
      const { error } = await supabase.from("category_limits").update({
        daily_limit: newLimit,
        updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast.success(newLimit === 0 ? "Limit disabled — no restriction!" : "Limit updated!");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
      onRefresh(); // revert to DB value
    } finally {
      setIsUpdating(null);
    }
  };

  const toggleLimit = async (l: any) => {
    const isEnabled = Number(l.daily_limit) > 0;
    if (isEnabled) {
      // Disable — set to 0
      await updateLimit(l.id, 0);
    } else {
      // Enable — set default 500
      await updateLimit(l.id, 500);
    }
  };

  const getTheme = (category: string) => {
    switch (category) {
      case "travel":  return { icon: <Car className="w-5 h-5" />,      color: "text-blue-600",   bg: "bg-blue-50",   accent: "#3B82F6" };
      case "meal":    return { icon: <Utensils className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50", accent: "#F97316" };
      case "hotel":   return { icon: <Hotel className="w-5 h-5" />,    color: "text-purple-600", bg: "bg-purple-50", accent: "#8B5CF6" };
      case "luggage": return { icon: <Luggage className="w-5 h-5" />,  color: "text-cyan-600",   bg: "bg-cyan-50",   accent: "#06B6D4" };
      default:        return { icon: <Briefcase className="w-5 h-5" />,color: "text-gray-600",   bg: "bg-gray-100",  accent: "#6B7280" };
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* Header */}
      <div className="px-1 flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="font-black text-gray-900 text-base tracking-tight flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" /> Policy Controls
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Daily expense limits per category</p>
        </div>
      </div>

      {/* Limit Cards */}
      <div className="grid gap-3">
        {localLimits.map((l) => {
          const theme = getTheme(l.category);
          const isEnabled = Number(l.daily_limit) > 0;
          const isLoading = isUpdating === l.id;

          return (
            <div
              key={l.id}
              className={`relative bg-white rounded-[2rem] border shadow-sm transition-all duration-300 overflow-hidden ${
                isEnabled ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"
              }`}
            >
              {/* Colored left accent bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-full transition-all duration-300"
                style={{ backgroundColor: isEnabled ? theme.accent : "#d1d5db" }}
              />

              <div className="p-4 pl-5">
                {/* Top row — icon + name + toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${isEnabled ? theme.bg : "bg-gray-100"} ${isEnabled ? theme.color : "text-gray-400"} flex items-center justify-center transition-all duration-300`}>
                      {theme.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase text-gray-800 tracking-wide">{l.category}</h3>
                      <p className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${isEnabled ? "text-emerald-500" : "text-gray-400"}`}>
                        {isEnabled ? "● Limit Active" : "○ No Limit"}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => !isLoading && toggleLimit(l)}
                    disabled={isLoading}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none ${
                      isEnabled ? "bg-emerald-500 shadow-emerald-100 shadow-md" : "bg-gray-200"
                    } ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
                      isEnabled ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* Amount input — only show when enabled */}
                <div className={`transition-all duration-300 overflow-hidden ${isEnabled ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-2.5">
                    <span className="text-[11px] font-black text-gray-400">Daily Max</span>
                    <div className="flex-1 flex items-center justify-end gap-1">
                      <span className="text-[13px] font-black text-gray-500">₹</span>
                      <input
                        type="number"
                        disabled={isLoading || !isEnabled}
                        key={l.daily_limit} // re-render on toggle
                        defaultValue={l.daily_limit}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val !== l.daily_limit && val > 0) updateLimit(l.id, val);
                        }}
                        className="w-24 text-right text-[15px] font-black text-gray-900 bg-transparent outline-none"
                        placeholder="0"
                      />
                    </div>
                    {isLoading && (
                      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </div>

                {/* Disabled hint */}
                {!isEnabled && (
                  <p className="text-[9px] text-gray-400 font-bold italic mt-1">
                    Toggle to set a daily limit for {l.category}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="p-5 bg-gray-900 rounded-[2rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ShieldCheck className="w-12 h-12 text-white" />
        </div>
        <div className="relative z-10 space-y-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Security Protocol</p>
          <p className="text-[11px] text-white font-medium leading-relaxed opacity-90">
            Changes logged with <span className="text-emerald-400 font-black">Admin: {currentUserId?.slice(0, 8)}</span>. Limits enforced in real-time. <span className="text-yellow-400 font-black">Toggle OFF = no restriction.</span>
          </p>
        </div>
      </div>
    </div>
  );
}