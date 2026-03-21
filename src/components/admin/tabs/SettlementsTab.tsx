import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronRight, CheckCircle2, Wallet, TrendingUp } from "lucide-react";
import ImagePreviewModal from "@/components/expense/ImagePreviewModal";

interface Props {
  expenses: any[];
  settlements: any[];
  users: any[];
  currentUserId: string;
  onRefresh: () => void;
}

export default function SettlementsTab({ expenses, settlements, users, currentUserId, onRefresh }: Props) {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const [missions, setMissions] = useState<any[]>([]);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [settleModal, setSettleModal] = useState<{
    open: boolean; missionId: string | null; missionName: string;
    amount: number; amountType: "full" | "partial"; note: string;
  }>({ open: false, missionId: null, missionName: "", amount: 0, amountType: "full", note: "" });
  const [previewUrl, setPreviewUrl] = useState("");
  const [tempFile, setTempFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  const fetchMissions = useCallback(async (userId: string) => {
    const { data } = await supabase.from("missions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setMissions(data || []);
  }, []);

  useEffect(() => {
    if (selectedUser) fetchMissions(selectedUser);
    else setMissions([]);
  }, [selectedUser, fetchMissions]);

  // Totals
  const gExp = expenses.filter(e => e.status === "approved" && e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
  const gRec = settlements.reduce((s, c) => s + Number(c.amount), 0);
  const gNet = gExp - gRec;

  const uExp = expenses.filter(e => e.user_id === selectedUser && e.status === "approved" && e.category !== "cash");
  const uSet = settlements.filter(s => s.user_id === selectedUser);
  const uSpent = uExp.reduce((s, e) => s + Number(e.amount), 0);
  const uRecv = uSet.reduce((s, c) => s + Number(c.amount), 0);
  const uBal = uSpent - uRecv;

  const getMissionData = (missionId: string) => {
    const mExp = expenses.filter(e => e.mission_id === missionId && e.status === "approved" && e.category !== "cash");
    const mSet = settlements.filter(s => s.mission_id === missionId);
    const spent = mExp.reduce((s, e) => s + Number(e.amount), 0);
    const received = mSet.reduce((s, c) => s + Number(c.amount), 0);
    return { spent, received, pending: spent - received, expenses: mExp, settlements: mSet };
  };

  const uploadProof = async (file: File) => {
    try {
      const ext = file.name.split(".").pop();
      const path = `proofs/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { error } = await supabase.storage.from("settlement-proofs").upload(path, file);
      if (error) throw error;
      return supabase.storage.from("settlement-proofs").getPublicUrl(path).data.publicUrl;
    } catch (err: any) { toast.error("Upload failed: " + err.message); return null; }
  };

  const handleSettle = async () => {
    if (!tempFile) return toast.error("Upload proof first!");
    if (!settleModal.amount || settleModal.amount <= 0) return toast.error("Enter valid amount!");
    setIsLoading(true);
    const url = await uploadProof(tempFile);
    if (!url) { setIsLoading(false); return; }
    try {
      const { error } = await (supabase.from("settlements" as any) as any).insert({
        user_id: selectedUser, mission_id: settleModal.missionId || null,
        amount: settleModal.amount, proof_url: url, settled_by: currentUserId,
        user_acknowledged: false,
        note: settleModal.note || (settleModal.missionId ? `Mission: ${settleModal.missionName}` : "All missions"),
      });
      if (error) throw error;
      toast.success("Settled!");
      setSettleModal({ open: false, missionId: null, missionName: "", amount: 0, amountType: "full", note: "" });
      setPreviewUrl(""); setTempFile(null);
      onRefresh();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsLoading(false); }
  };

  const openSettle = (missionId: string | null, missionName: string, amount: number) => {
    setSettleModal({ open: true, missionId, missionName, amount, amountType: amount > 0 ? "full" : "partial", note: "" });
    setPreviewUrl(""); setTempFile(null);
  };

  const selectedUserName = users.find(u => u.id === selectedUser)?.name || "";

  return (
    <div className="space-y-3 pb-24 px-3 animate-fade-in">

      {/* Company card — compact */}
      <div className="rounded-[1.6rem] p-4 text-white" style={{background:"linear-gradient(135deg,#1e3a5f 0%,#0f2444 100%)"}}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Company Outstanding</p>
            <p className="text-2xl font-black tracking-tighter">₹{gNet.toLocaleString()}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[7px] font-black uppercase text-white/30">Expenses <span className="text-white/70">₹{gExp.toLocaleString()}</span></p>
            <p className="text-[7px] font-black uppercase text-white/30">Paid <span className="text-white/70">₹{gRec.toLocaleString()}</span></p>
          </div>
        </div>
      </div>

      {/* Employee selector — custom dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="w-full bg-white rounded-[1.4rem] border border-gray-100 shadow-sm px-4 py-3.5 flex items-center justify-between gap-3 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            {selectedUser ? (
              <>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>
                  <span className="text-white text-[11px] font-black">
                    {selectedUserName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[11px] font-black text-gray-900 uppercase tracking-tight truncate">{selectedUserName}</p>
                  <p className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">Selected Employee</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-400 text-[14px]">👤</span>
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Employee</p>
              </>
            )}
          </div>
          <div className={`w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}>
            <svg className="w-2.5 h-2.5 text-gray-500" fill="none" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </button>

        {/* Dropdown list */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[1.2rem] border border-gray-100 shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
            <div className="max-h-64 overflow-y-auto py-1.5">
              {users.map((u: any) => {
                const isSelected = selectedUser === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUser(u.id); setExpandedMission(null); setDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${isSelected ? "bg-gray-50" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? "" : "bg-gray-100"}`} style={isSelected ? {background:"linear-gradient(135deg,#2563eb,#1d4ed8)"} : {}}>
                      <span className={`text-[11px] font-black ${isSelected ? "text-white" : "text-gray-500"}`}>
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black uppercase truncate ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                        {u.name || u.email}
                      </p>
                      <p className="text-[7px] font-bold text-gray-400 uppercase">{u.email || ""}</p>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-200">

          {/* User summary — compact horizontal */}
          <div className={`rounded-[1.6rem] p-4 text-white ${uBal > 0 ? "bg-rose-500" : "bg-emerald-600"}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[7px] font-black uppercase opacity-60 tracking-widest">{selectedUserName}</p>
                <p className="text-2xl font-black tracking-tighter mt-0.5">₹{Math.abs(uBal).toLocaleString()}</p>
                <p className="text-[7px] opacity-50 font-bold">{uBal > 0 ? "pending to pay" : "advance"}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {uBal > 0 && (
                  <button onClick={() => openSettle(null, "All Missions", uBal)}
                    className="px-3 py-1.5 rounded-xl text-[8px] font-black uppercase shadow-md active:scale-90 transition-all" style={{background:"white",color:"#1d4ed8"}}>
                    Settle All
                  </button>
                )}
                <button onClick={() => openSettle(null, "All Missions", 0)}
                  className="bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase active:scale-90 transition-all">
                  + Add
                </button>
              </div>
            </div>
            {/* Stats row */}
            <div className="flex gap-3 pt-2.5 border-t border-white/10">
              <div>
                <p className="text-[6px] font-black uppercase opacity-40">Spent</p>
                <p className="text-[10px] font-black">₹{uSpent.toLocaleString()}</p>
              </div>
              <div className="border-l border-white/10 pl-3">
                <p className="text-[6px] font-black uppercase opacity-40">Received</p>
                <p className="text-[10px] font-black">₹{uRecv.toLocaleString()}</p>
              </div>
              <div className="border-l border-white/10 pl-3">
                <p className="text-[6px] font-black uppercase opacity-40">Missions</p>
                <p className="text-[10px] font-black">{missions.length}</p>
              </div>
            </div>
          </div>

          {/* Mission list */}
          <div className="bg-white rounded-[1.6rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Mission Wise</p>
              <span className="text-[7px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{missions.length}</span>
            </div>

            {missions.length === 0 ? (
              <div className="py-8 text-center text-[9px] font-black uppercase text-gray-200 tracking-widest">No Missions</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {missions.map((m: any) => {
                  const md = getMissionData(m.id);
                  const isOpen = expandedMission === m.id;
                  const isActive = m.status === "active" || m.status === "pending";
                  const isSettled = md.pending <= 0 && md.spent > 0;
                  const noPending = md.spent === 0;

                  return (
                    <div key={m.id}>
                      {/* Mission row */}
                      <button
                        onClick={() => setExpandedMission(isOpen ? null : m.id)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        {/* Status dot */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />

                        {/* Name + date */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase text-gray-900 truncate">{m.name}</p>
                          <p className="text-[7px] text-gray-400 font-bold mt-0.5">
                            {new Date(m.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {m.end_date ? ` → ${new Date(m.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : " → Ongoing"}
                          </p>
                        </div>

                        {/* Amount + status */}
                        <div className="text-right flex-shrink-0">
                          {noPending ? (
                            <p className="text-[8px] font-black text-gray-300 uppercase">No expenses</p>
                          ) : isSettled ? (
                            <div className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="text-[8px] font-black uppercase">Settled</span>
                            </div>
                          ) : (
                            <p className="text-[12px] font-black text-rose-500">₹{md.pending.toLocaleString()}</p>
                          )}
                          <p className="text-[7px] text-gray-300 font-bold">{md.expenses.length} exp</p>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>

                      {/* Expanded mission detail */}
                      {isOpen && (
                        <div className="bg-gray-50 px-4 py-3 space-y-3 animate-in slide-in-from-top-1 duration-150">

                          {/* 3 stat pills */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
                              <p className="text-[6px] font-black uppercase text-gray-400">Expenses</p>
                              <p className="text-[11px] font-black text-gray-900 mt-0.5">₹{md.spent.toLocaleString()}</p>
                            </div>
                            <div className="bg-white rounded-xl p-2.5 text-center border border-emerald-100">
                              <p className="text-[6px] font-black uppercase text-emerald-500">Received</p>
                              <p className="text-[11px] font-black text-emerald-700 mt-0.5">₹{md.received.toLocaleString()}</p>
                            </div>
                            <div className={`rounded-xl p-2.5 text-center border ${md.pending > 0 ? "bg-white border-rose-100" : "bg-white border-emerald-100"}`}>
                              <p className={`text-[6px] font-black uppercase ${md.pending > 0 ? "text-rose-400" : "text-emerald-500"}`}>Pending</p>
                              <p className={`text-[11px] font-black mt-0.5 ${md.pending > 0 ? "text-rose-600" : "text-emerald-700"}`}>₹{Math.abs(md.pending).toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Payment history for this mission */}
                          {md.settlements.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[6px] font-black uppercase text-gray-400 tracking-widest">Payment History</p>
                              {md.settlements.map((s: any, i: number) => (
                                <div key={i} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between border border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px]">💰</span>
                                    <div>
                                      <p className="text-[9px] font-black text-gray-800">₹{Number(s.amount).toLocaleString()}</p>
                                      <p className="text-[7px] text-gray-400">{new Date(s.created_at).toLocaleDateString("en-IN")}{s.note ? ` · ${s.note}` : ""}</p>
                                    </div>
                                  </div>
                                  {s.proof_url && (
                                    <button onClick={() => setSelectedPreviewImage(s.proof_url)}
                                      className="text-[7px] bg-gray-50 border border-gray-100 px-1.5 py-1 rounded-lg font-black text-gray-500">🖼️</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            {md.pending > 0 && (
                              <button onClick={() => openSettle(m.id, m.name, md.pending)}
                                className="flex-1 py-2.5 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all" style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>
                                Settle ₹{md.pending.toLocaleString()}
                              </button>
                            )}
                            <button onClick={() => openSettle(m.id, m.name, 0)}
                              className="flex-1 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">
                              + Partial
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All payment logs */}
          <div className="bg-white rounded-[1.6rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">All Payment Logs</p>
              <span className="text-[7px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{uSet.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
              {uSet.length === 0 ? (
                <div className="py-8 text-center text-[9px] font-black uppercase text-gray-200 tracking-widest">No Transactions</div>
              ) : [...uSet].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((s: any, i: number) => {
                const mName = s.mission_id ? missions.find((m: any) => m.id === s.mission_id)?.name : null;
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Wallet className="w-3 h-3 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[10px] font-black text-gray-900">₹{Number(s.amount).toLocaleString()}</p>
                          <span className={`text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase ${mName ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                            {mName || "All Missions"}
                          </span>
                        </div>
                        <p className="text-[7px] text-gray-400 font-bold truncate">
                          {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {s.note ? ` · ${s.note}` : ""}
                        </p>
                      </div>
                    </div>
                    {s.proof_url && (
                      <button onClick={() => setSelectedPreviewImage(s.proof_url)}
                        className="ml-2 p-1.5 bg-gray-50 border border-gray-100 rounded-lg flex-shrink-0">
                        <span className="text-[9px]">🖼️</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {settleModal.open && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] p-5 shadow-2xl space-y-3 pb-8">

            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-1" />

            <div className="flex justify-between items-start">
              <div>
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">
                  {settleModal.missionId ? "Mission Settlement" : "Full Settlement"}
                </p>
                {settleModal.missionId && (
                  <p className="text-[11px] font-black text-gray-900 uppercase mt-0.5 truncate max-w-[220px]">{settleModal.missionName}</p>
                )}
              </div>
              <button onClick={() => { setSettleModal(s => ({...s, open: false})); setPreviewUrl(""); setTempFile(null); }}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-black text-sm">×</button>
            </div>

            {/* Full / Partial toggle */}
            <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setSettleModal(s => ({ ...s, amountType: "full", amount: settleModal.missionId ? getMissionData(settleModal.missionId).pending : uBal }))}
                className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${settleModal.amountType === "full" ? "text-white shadow-sm" : "text-gray-400"}`} style={settleModal.amountType === "full" ? {background:"linear-gradient(135deg,#2563eb,#1d4ed8)"} : {}}>
                Full
              </button>
              <button
                onClick={() => setSettleModal(s => ({ ...s, amountType: "partial", amount: 0 }))}
                className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${settleModal.amountType === "partial" ? "text-white shadow-sm" : "text-gray-400"}`} style={settleModal.amountType === "partial" ? {background:"linear-gradient(135deg,#2563eb,#1d4ed8)"} : {}}>
                Partial
              </button>
            </div>

            {/* Amount */}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-gray-400 font-black text-lg">₹</span>
              <input type="number" placeholder="0"
                value={settleModal.amount || ""}
                readOnly={settleModal.amountType === "full"}
                onChange={(e) => setSettleModal(s => ({ ...s, amount: Number(e.target.value) }))}
                className="flex-1 bg-transparent text-xl font-black outline-none text-gray-900" />
            </div>

            {/* Note */}
            <input type="text" placeholder="Note (UPI / Cash / Bank)"
              value={settleModal.note}
              onChange={(e) => setSettleModal(s => ({ ...s, note: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />

            {/* Proof upload */}
            {!previewUrl ? (
              <label className="w-full h-20 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all">
                <span className="text-lg">📸</span>
                <span className="text-[7px] font-black uppercase text-gray-400 mt-0.5">Upload Proof</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setTempFile(f); setPreviewUrl(URL.createObjectURL(f)); }
                }} />
              </label>
            ) : (
              <div className="relative h-20 rounded-2xl overflow-hidden border-2 border-gray-100">
                <img src={previewUrl} className="w-full h-full object-cover" alt="proof" />
                <button onClick={() => { setPreviewUrl(""); setTempFile(null); }}
                  className="absolute top-1.5 right-1.5 bg-red-500 text-white w-5 h-5 rounded-full font-black text-[9px] flex items-center justify-center">×</button>
              </div>
            )}

            <button onClick={handleSettle}
              disabled={!settleModal.amount || !tempFile || isLoading}
              className="w-full py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-20 active:scale-95 transition-all" style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Confirm ₹${(settleModal.amount || 0).toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      <ImagePreviewModal imageUrl={selectedPreviewImage} onClose={() => setSelectedPreviewImage(null)} />
    </div>
  );
}