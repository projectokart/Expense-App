import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Check, CheckCheck, Wallet, XCircle, CheckCircle, Trash2, FileText, AlertTriangle } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  expense_approved: { icon: CheckCircle, color: "text-success" },
  expense_rejected: { icon: XCircle, color: "text-destructive" },
  expense_deleted: { icon: Trash2, color: "text-destructive" },
  settlement: { icon: Wallet, color: "text-primary" },
  mission_deleted: { icon: AlertTriangle, color: "text-warning" },
  general: { icon: Bell, color: "text-muted-foreground" },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setNotifications((data as any) || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications" as any).update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications" as any).update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary p-5 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="bg-primary-foreground/10 p-2 rounded-xl text-primary-foreground border border-white/10 active:scale-90 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black italic tracking-tighter text-primary-foreground uppercase">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-[10px] font-bold text-primary-foreground/70">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 bg-primary-foreground/10 px-3 py-2 rounded-xl text-primary-foreground text-[9px] font-black uppercase border border-white/10 active:scale-90">
              <CheckCheck className="w-3.5 h-3.5" />
              Read All
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 py-4 space-y-2">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-xs">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No Notifications</p>
          </div>
        ) : (
          notifications.map(n => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.general;
            const Icon = config.icon;
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markAsRead(n.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
                  n.is_read
                    ? "bg-card border-border/40 opacity-60"
                    : "bg-card border-primary/20 shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.is_read ? "bg-muted" : "bg-primary/10"}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className={`text-[11px] font-black uppercase tracking-tight ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                        {n.title}
                      </p>
                      {!n.is_read && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />}
                    </div>
                    {n.message && (
                      <p className="text-[9px] text-muted-foreground font-medium mt-0.5 leading-relaxed">{n.message}</p>
                    )}
                    <p className="text-[8px] text-muted-foreground/50 font-bold mt-1">
                      {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
