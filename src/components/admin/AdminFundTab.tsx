import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import ImagePreviewModal from "@/components/expense/ImagePreviewModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wallet, Plus, Trash2, Pencil, FileSpreadsheet, Loader2, ArrowDown, ArrowUp, IndianRupee, Building2, X
} from 'lucide-react';

interface FundEntry {
  id: string;
  amount: number;
  source: string;
  note: string | null;
  receipt_url: string | null;
  created_by: string;
  created_at: string;
}

interface Settlement {
  id: string;
  amount: number;
  user_id: string | null;
  mission_id: string | null;
  note: string | null;
  proof_url: string | null;
  settled_by: string | null;
  created_at: string | null;
  status: string | null;
  user_acknowledged: boolean | null;
}

interface AdminFundTabProps {
  settlements: Settlement[];
  users: any[];
  onRefresh: () => void;
}

export default function AdminFundTab({ settlements, users, onRefresh }: AdminFundTabProps) {
  const { user } = useAuth();
  const [fundEntries, setFundEntries] = useState<FundEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Add fund modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ amount: 0, source: '', note: '' });
  const [addReceiptFile, setAddReceiptFile] = useState<File | null>(null);
  const [addReceiptPreview, setAddReceiptPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Edit fund modal
  const [editEntry, setEditEntry] = useState<FundEntry | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, source: '', note: '' });

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit settlement
  const [editSettlement, setEditSettlement] = useState<Settlement | null>(null);
  const [editSettlementForm, setEditSettlementForm] = useState({ amount: 0, note: '' });
  const [deleteSettlementId, setDeleteSettlementId] = useState<string | null>(null);

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => { fetchFunds(); }, []);

  const fetchFunds = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fund_entries' as any).select('*').order('created_at', { ascending: false });
    if (error) { toast.error(error.message); }
    else { setFundEntries((data as any) || []); }
    setLoading(false);
  };

  const totalFunds = useMemo(() => fundEntries.reduce((s, f) => s + Number(f.amount), 0), [fundEntries]);
  const totalSettled = useMemo(() => settlements.reduce((s, c) => s + Number(c.amount), 0), [settlements]);
  const remainingFunds = totalFunds - totalSettled;

  // --- FUND CRUD ---
  const uploadReceipt = async (file: File) => {
    try {
      const ext = file.name.split('.').pop();
      const path = `fund-receipts/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { error } = await supabase.storage.from('settlement-proofs').upload(path, file);
      if (error) throw error;
      return supabase.storage.from('settlement-proofs').getPublicUrl(path).data.publicUrl;
    } catch (err: any) { toast.error("Upload failed: " + err.message); return null; }
  };

  const handleAddFund = async () => {
    if (!addForm.amount || addForm.amount <= 0) return toast.error("Enter a valid amount");
    if (!addForm.source.trim()) return toast.error("Enter source/sender name");
    setSaving(true);
    let receiptUrl: string | null = null;
    if (addReceiptFile) {
      receiptUrl = await uploadReceipt(addReceiptFile);
    }
    const { error } = await supabase.from('fund_entries' as any).insert({
      amount: addForm.amount, source: addForm.source.trim(),
      note: addForm.note.trim() || null,
      receipt_url: receiptUrl,
      created_by: user?.id
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Fund added!");
      setAddForm({ amount: 0, source: '', note: '' });
      setAddReceiptFile(null); setAddReceiptPreview('');
      setIsAddOpen(false); fetchFunds();
    }
    setSaving(false);
  };

  const handleEditFund = async () => {
    if (!editEntry) return;
    if (!editForm.amount || editForm.amount <= 0) return toast.error("Invalid amount");
    const { error } = await supabase.from('fund_entries' as any).update({
      amount: editForm.amount, source: editForm.source.trim(), note: editForm.note.trim() || null
    }).eq('id', editEntry.id);
    if (error) toast.error(error.message);
    else { toast.success("Fund updated!"); setEditEntry(null); fetchFunds(); }
  };

  const handleDeleteFund = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('fund_entries' as any).delete().eq('id', deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Fund entry deleted!"); fetchFunds(); }
    setDeleteId(null);
  };

  // --- SETTLEMENT EDIT/DELETE ---
  const handleEditSettlement = async () => {
    if (!editSettlement) return;
    const { error } = await supabase.from('settlements' as any).update({
      amount: editSettlementForm.amount, note: editSettlementForm.note.trim() || null
    }).eq('id', editSettlement.id);
    if (error) toast.error(error.message);
    else { toast.success("Settlement updated!"); setEditSettlement(null); onRefresh(); }
  };

  const handleDeleteSettlement = async () => {
    if (!deleteSettlementId) return;
    const { error } = await supabase.from('settlements' as any).delete().eq('id', deleteSettlementId);
    if (error) toast.error(error.message);
    else { toast.success("Settlement deleted!"); onRefresh(); }
    setDeleteSettlementId(null);
  };

  // --- EXCEL EXPORTS ---
  const exportFunds = () => {
    if (fundEntries.length === 0) return toast.error("No fund entries to export");
    const rows = fundEntries.map(f => ({
      "Date": new Date(f.created_at).toLocaleDateString(),
      "Amount (₹)": Number(f.amount),
      "Source": f.source, "Note": f.note || ""
    }));
    rows.push({ "Date": "TOTAL", "Amount (₹)": totalFunds, "Source": "", "Note": "" });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funds");
    XLSX.writeFile(wb, `Funds_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Funds exported!");
  };

  const exportSettlements = () => {
    if (settlements.length === 0) return toast.error("No settlements to export");
    const rows = settlements.map(s => {
      const u = users.find(u => u.id === s.user_id);
      return {
        "Date": s.created_at ? new Date(s.created_at).toLocaleDateString() : "",
        "Employee": u?.name || u?.email || "Unknown",
        "Amount (₹)": Number(s.amount),
        "Note": s.note || "", "Proof": s.proof_url || ""
      };
    });
    rows.push({ "Date": "TOTAL PAID", "Employee": "", "Amount (₹)": totalSettled, "Note": "", "Proof": "" });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Settlements");
    XLSX.writeFile(wb, `Settlements_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Settlements exported!");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in pb-24 px-3">
      {/* OVERVIEW CARD */}
      <div className="rounded-[1.6rem] p-4 text-white relative overflow-hidden" style={{background:"linear-gradient(135deg,#1e3a5f,#0f2444)"}}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.2em] text-blue-300 opacity-80 mb-1">Fund Pool</p>
            <h2 className={`text-3xl font-black tracking-tighter ${remainingFunds >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{Math.abs(remainingFunds).toLocaleString()}
            </h2>
            <p className="text-[7px] font-bold mt-0.5 opacity-60">
              {remainingFunds >= 0 ? '✅ Available Balance' : '⚠️ Deficit — Paid more than received'}
            </p>
          </div>
          <button onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[8px] font-black uppercase active:scale-90 transition-all"
            style={{background:"rgba(255,255,255,0.15)"}}>
            <Plus className="w-3.5 h-3.5" /> Add Fund
          </button>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          <div className="rounded-xl p-2.5 text-center" style={{background:"rgba(255,255,255,0.06)"}}>
            <p className="text-[6px] font-black uppercase text-white/30 mb-1">Total Received</p>
            <p className="text-[10px] font-black text-emerald-400">₹{totalFunds.toLocaleString()}</p>
            <p className="text-[6px] text-white/30">{fundEntries.length} entries</p>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{background:"rgba(255,255,255,0.06)"}}>
            <p className="text-[6px] font-black uppercase text-white/30 mb-1">Paid Out</p>
            <p className="text-[10px] font-black text-rose-400">₹{totalSettled.toLocaleString()}</p>
            <p className="text-[6px] text-white/30">{settlements.length} payments</p>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{background: remainingFunds < 0 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.1)"}}>
            <p className="text-[6px] font-black uppercase text-white/30 mb-1">Balance</p>
            <p className={`text-[10px] font-black ${remainingFunds >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {remainingFunds < 0 ? "-" : ""}₹{Math.abs(remainingFunds).toLocaleString()}
            </p>
            <p className={`text-[6px] ${remainingFunds >= 0 ? "text-emerald-400/60" : "text-rose-400/60"}`}>
              {remainingFunds >= 0 ? "Surplus" : "Deficit"}
            </p>
          </div>
        </div>
      </div>



      {/* FUND ENTRIES HISTORY */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-3 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
          <span className="text-[9px] font-black uppercase opacity-40 tracking-widest italic ml-2">Fund History</span>
          <button onClick={exportFunds} className="text-blue-600 text-[8px] font-black uppercase border border-blue-100 px-2 py-1 rounded-md flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {fundEntries.length > 0 ? fundEntries.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              {f.receipt_url ? (
                <div onClick={() => setPreviewImage(f.receipt_url)}
                  className="w-10 h-10 rounded-xl border border-gray-100 overflow-hidden cursor-pointer flex-shrink-0">
                  <img src={f.receipt_url} className="w-full h-full object-cover" alt="receipt" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-blue-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-gray-900 uppercase truncate">{f.source || 'Company'}</p>
                <p className="text-[7px] text-gray-400 font-bold">
                  {new Date(f.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                  {f.note ? ` · ${f.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[11px] font-black text-blue-600">₹{Number(f.amount).toLocaleString()}</span>
                <button onClick={() => { setEditEntry(f); setEditForm({ amount: f.amount, source: f.source, note: f.note || '' }); }}
                  className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                  <Pencil className="w-3 h-3 text-gray-400" />
                </button>
                <button onClick={() => setDeleteId(f.id)}
                  className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                  <Trash2 className="w-3 h-3 text-rose-400" />
                </button>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center opacity-10 font-black text-xs italic tracking-widest">No Fund Entries</div>
          )}
        </div>
      </div>

      {/* SETTLEMENT HISTORY WITH EDIT/DELETE */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-3 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
          <span className="text-[9px] font-black uppercase opacity-40 tracking-widest italic ml-2">Payment History (Settled)</span>
          <button onClick={exportSettlements} className="text-emerald-600 text-[8px] font-black uppercase border border-emerald-100 px-2 py-1 rounded-md flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {settlements.length > 0 ? [...settlements].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).map((s) => {
            const u = users.find(u => u.id === s.user_id);
            return (
              <div key={s.id} className="flex items-center justify-between p-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-[10px]">💰</div>
                  <div>
                    <p className="text-[10px] font-black text-gray-800">{u?.name || u?.email || 'Unknown'}</p>
                    <p className="text-[8px] text-gray-400 font-bold">{s.created_at ? new Date(s.created_at).toLocaleDateString() : ''} {s.note ? `• ${s.note}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-emerald-600">₹{Number(s.amount).toLocaleString()}</span>
                  {s.proof_url && (
                    <button onClick={() => setPreviewImage(s.proof_url)} className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px]">🖼️</button>
                  )}
                  <button onClick={() => { setEditSettlement(s); setEditSettlementForm({ amount: Number(s.amount), note: s.note || '' }); }}
                    className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                    <Pencil className="w-3 h-3 text-gray-400" />
                  </button>
                  <button onClick={() => setDeleteSettlementId(s.id)}
                    className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                    <Trash2 className="w-3 h-3 text-rose-400" />
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-10 text-center opacity-10 font-black text-xs italic tracking-widest">No Settlements</div>
          )}
        </div>
      </div>

      {/* ADD FUND MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto bg-black/70 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-5 shadow-2xl space-y-3 my-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Add Fund Received</p>
              </div>
              <button onClick={() => { setIsAddOpen(false); setAddReceiptFile(null); setAddReceiptPreview(''); }}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
            </div>

            {/* Amount */}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-gray-400 font-black text-lg">₹</span>
              <input type="number" placeholder="Amount"
                value={addForm.amount || ''}
                onChange={e => setAddForm({ ...addForm, amount: Number(e.target.value) })}
                className="flex-1 bg-transparent text-xl font-black outline-none text-gray-900" />
            </div>

            {/* Sender name */}
            <input type="text" placeholder="Sender / Company Name *"
              value={addForm.source}
              onChange={e => setAddForm({ ...addForm, source: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />

            {/* Note */}
            <input type="text" placeholder="Note (optional)"
              value={addForm.note}
              onChange={e => setAddForm({ ...addForm, note: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />

            {/* Receipt upload */}
            {!addReceiptPreview ? (
              <label className="w-full h-20 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all">
                <span className="text-lg">📄</span>
                <span className="text-[7px] font-black uppercase text-gray-400 mt-0.5">Upload Receipt (optional)</span>
                <input type="file" className="hidden" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setAddReceiptFile(f); setAddReceiptPreview(URL.createObjectURL(f)); }
                }} />
              </label>
            ) : (
              <div className="relative h-20 rounded-2xl overflow-hidden border-2 border-gray-100">
                <img src={addReceiptPreview} className="w-full h-full object-cover" alt="receipt" />
                <button onClick={() => { setAddReceiptFile(null); setAddReceiptPreview(''); }}
                  className="absolute top-1.5 right-1.5 bg-red-500 text-white w-5 h-5 rounded-full font-black text-[9px] flex items-center justify-center">×</button>
              </div>
            )}

            <button onClick={handleAddFund} disabled={saving}
              className="w-full py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-20 active:scale-95 transition-all"
              style={{background:"linear-gradient(135deg,#1e3a5f,#0f2444)"}}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirm & Add Fund"}
            </button>
          </div>
          </div>
        </div>
      )}

      {/* EDIT FUND MODAL */}
      {editEntry && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-[0.2em]">✏️ Edit Fund</h3>
              <button onClick={() => setEditEntry(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <input type="number" value={editForm.amount || ''} onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-2xl font-black outline-none border-2 border-transparent focus:border-gray-100" />
            <input type="text" value={editForm.source} onChange={e => setEditForm({ ...editForm, source: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <button onClick={handleEditFund}
              className="w-full py-5 bg-gray-900 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* EDIT SETTLEMENT MODAL */}
      {editSettlement && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-[0.2em]">✏️ Edit Settlement</h3>
              <button onClick={() => setEditSettlement(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <input type="number" value={editSettlementForm.amount || ''} onChange={e => setEditSettlementForm({ ...editSettlementForm, amount: Number(e.target.value) })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-2xl font-black outline-none border-2 border-transparent focus:border-gray-100" />
            <input type="text" placeholder="Note" value={editSettlementForm.note} onChange={e => setEditSettlementForm({ ...editSettlementForm, note: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <button onClick={handleEditSettlement}
              className="w-full py-5 bg-gray-900 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* DELETE FUND CONFIRM */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fund entry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this fund record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFund} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DELETE SETTLEMENT CONFIRM */}
      <AlertDialog open={!!deleteSettlementId} onOpenChange={(o) => !o && setDeleteSettlementId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this settlement?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this payment record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSettlement} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
