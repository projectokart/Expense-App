import { useMemo, useState } from "react";
import { Filter, Target, LayoutGrid, Activity, BarChart3, FileSpreadsheet, CheckCircle, Printer, ImageIcon, ChevronDown, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import ImagePreviewModal from "@/components/expense/ImagePreviewModal";

interface Props {
  expenses: any[];
  settlements: any[];
  users: any[];
  uniqueUsers: string[];
}

const catColors: Record<string, string> = {
  travel: "#3B82F6", meal: "#F97316", hotel: "#8B5CF6",
  luggage: "#06B6D4", cash: "#6B7280", other: "#64748B",
};
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function ReportsTab({ expenses, settlements, users, uniqueUsers }: Props) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedMissions, setSelectedMissions] = useState<string[]>([]);
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [step1Open, setStep1Open] = useState(false);
  const [step2Open, setStep2Open] = useState(false);

  // Unique missions for selected employees
  const availableMissions = useMemo(() => {
    if (selectedUsers.length === 0) return [];
    const list = expenses.filter(e => selectedUsers.includes(e.profiles?.name || ""));
    return Array.from(new Set(list.map(e => e.missions?.name).filter(Boolean))) as string[];
  }, [expenses, selectedUsers]);

  // Toggle employee
  const toggleUser = (name: string) => {
    const next = selectedUsers.includes(name)
      ? selectedUsers.filter(u => u !== name)
      : [...selectedUsers, name];
    setSelectedUsers(next);
    setSelectedMissions([]);
  };

  // Toggle mission
  const toggleMission = (name: string) => {
    setSelectedMissions(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  // Select all missions
  const selectAllMissions = () => {
    if (selectedMissions.length === availableMissions.length) {
      setSelectedMissions([]);
    } else {
      setSelectedMissions([...availableMissions]);
    }
  };

  const hasData = selectedUsers.length > 0 && selectedMissions.length > 0;

  // Filtered expenses
  const filtered = useMemo(() => {
    if (!hasData) return [];
    return expenses.filter(e => {
      const uName = e.profiles?.name || "";
      const mName = e.missions?.name || "";
      return selectedUsers.includes(uName) &&
        selectedMissions.includes(mName) &&
        (catFilter === "all" || e.category === catFilter) &&
        (statusFilter === "all" || e.status === statusFilter);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedUsers, selectedMissions, catFilter, statusFilter]);

  // Overall totals
  const approvedList  = filtered.filter(e => e.status === "approved" && e.category !== "cash");
  const rejectedList  = filtered.filter(e => e.status === "rejected");
  const totalApproved = approvedList.reduce((s, e) => s + Number(e.amount), 0);
  const totalRejected = rejectedList.reduce((s, e) => s + Number(e.amount), 0);

  // Settlements for selected users
  const relevantSettlements = useMemo(() => settlements.filter((s: any) => {
    const u = users.find((u: any) => u.id === s.user_id);
    return selectedUsers.includes(u?.name || "");
  }), [settlements, users, selectedUsers]);
  const totalReceived  = relevantSettlements.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const pendingPayable = totalApproved - totalReceived;

  // Mission-wise breakdown
  const missionBreakdown = useMemo(() => {
    return selectedMissions.map(mName => {
      const mExp = filtered.filter(e => e.missions?.name === mName);
      const mApproved = mExp.filter(e => e.status === "approved" && e.category !== "cash");
      const mRejected = mExp.filter(e => e.status === "rejected");
      const mPending  = mExp.filter(e => e.status === "pending");
      const spent    = mApproved.reduce((s, e) => s + Number(e.amount), 0);
      const rejected = mRejected.reduce((s, e) => s + Number(e.amount), 0);

      // Settlements for this mission
      const mSet = relevantSettlements.filter((s: any) => {
        const mExpIds = mExp.map(e => e.mission_id);
        return mExpIds.includes(s.mission_id) || s.mission_id === null;
      });
      // Better: match mission_id from expenses
      const missionId = mExp[0]?.mission_id || null;
      const mSetFiltered = relevantSettlements.filter((s: any) => s.mission_id === missionId);
      const received = mSetFiltered.reduce((s: number, c: any) => s + Number(c.amount), 0);

      // User names in this mission
      const userNames = [...new Set(mExp.map(e => e.profiles?.name).filter(Boolean))];

      const pendingAmount = spent - received;
      return {
        name: mName, missionId, expenses: mExp,
        approvedList: mApproved, rejectedList: mRejected, pendingList: mPending,
        spent, rejectedTotal: mRejected.reduce((s: number, e: any) => s + Number(e.amount), 0),
        received, pending: pendingAmount,
        userNames,
      };
    });
  }, [selectedMissions, filtered, relevantSettlements]);

  const sanitize = (s: string) => {
    let c = String(s || "").replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(c)) c = "'" + c;
    return c;
  };

  const exportExcel = () => {
    if (filtered.length === 0) return toast.error("No data to export");
    const rows = filtered.map(e => ({
      "Date": e.date, "Employee": sanitize(e.profiles?.name || "N/A"),
      "Mission": sanitize(e.missions?.name || "General"),
      "Category": e.category.toUpperCase(), "Description": sanitize(e.description || ""),
      "Amount (₹)": Number(e.amount), "Status": e.status.toUpperCase(),
      "Admin Note": sanitize(e.admin_note || ""), "Receipt": e.image_url || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(`${filtered.length} records exported!`);
  };

  const printReport = () => {
    if (filtered.length === 0) return toast.error("No data to print");
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const buildRows = (list: any[], showImg: boolean) => list.map(e => {
      const imgHtml = e.image_url
        ? `<img src="${e.image_url}" style="width:160px;height:160px;object-fit:cover;border-radius:12px;border:2px solid #e5e7eb;display:block;"/>`
        : `<div style="width:80px;height:80px;border-radius:8px;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:9px;">NO RECEIPT</div>`;
      const amtStyle = e.status === "rejected" ? "color:#ef4444;text-decoration:line-through;" : "color:#059669;font-weight:700;";
      const badge = e.status === "approved" ? `<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800;">APPROVED</span>`
        : e.status === "rejected" ? `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800;">REJECTED</span>`
        : `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800;">PENDING</span>`;
      const col = catColors[e.category] || "#6b7280";
      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px;font-size:10px;color:#6b7280;">${e.date}</td>
        <td style="padding:8px;font-size:10px;font-weight:700;">${e.profiles?.name||"Unknown"}</td>
        <td style="padding:8px;"><span style="background:${col}18;color:${col};padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800;text-transform:uppercase;">${e.category}</span></td>
        <td style="padding:8px;font-size:10px;max-width:160px;">${e.description||"-"}</td>
        <td style="padding:8px;text-align:right;font-size:11px;${amtStyle}">${fmt(Number(e.amount))}</td>
        <td style="padding:8px;text-align:center;">${badge}</td>
        <td style="padding:6px 8px;text-align:center;vertical-align:middle;">${showImg ? imgHtml : (e.image_url ? `<img src="${e.image_url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;opacity:0.4;"/>` : "")}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Expense Report</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#f8fafc; }
.page { max-width:960px; margin:0 auto; background:#fff; }
.header { background:linear-gradient(135deg,#1e3a5f,#0f2444); color:#fff; padding:28px 36px; }
.brand { font-size:20px; font-weight:900; } .brand span { color:#34d399; }
.summary { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:16px 36px; background:#f1f5f9; }
.card { background:#fff; border-radius:10px; padding:12px; border:1px solid #e2e8f0; }
.card-label { font-size:7px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; margin-bottom:3px; }
.card-value { font-size:16px; font-weight:900; }
.mission-section { padding:16px 36px 0; }
.mission-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:12px; }
.mission-title { font-size:12px; font-weight:800; text-transform:uppercase; color:#1e3a5f; margin-bottom:8px; }
.mission-stats { display:flex; gap:16px; font-size:9px; color:#6b7280; }
.mission-stats strong { color:#111; font-weight:800; }
.table-section { padding:16px 36px 24px; }
.section-header { display:flex; align-items:center; gap:8px; padding:12px 0 8px; }
.section-dot { width:8px; height:8px; border-radius:50%; }
.section-label { font-size:10px; font-weight:800; text-transform:uppercase; }
.section-count { font-size:8px; color:#94a3b8; margin-left:auto; }
table { width:100%; border-collapse:collapse; font-size:11px; }
th { padding:7px 8px; text-align:left; font-size:7px; font-weight:800; text-transform:uppercase; color:#94a3b8; border-bottom:2px solid #f1f5f9; }
th:last-child,th:nth-last-child(2) { text-align:center; } th:nth-child(5) { text-align:right; }
.total-row td { padding:8px; background:#f8fafc; font-weight:900; font-size:11px; border-top:2px solid #e2e8f0; }
.footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 36px; display:flex; justify-content:space-between; align-items:center; }
@media print {
  @page { size:A4 portrait; margin:10mm; }
  body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .no-print { display:none !important; }
  img { max-width:160px; max-height:160px; }
}
</style></head><body><div class="page">
<div class="header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div class="brand">Expense<span>.</span>Report</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:6px;line-height:1.8;">
        <div style="font-size:12px;font-weight:700;color:#e2e8f0;">Official Expense Summary</div>
        <div>Generated: ${today}</div>
        <div>Employees: ${selectedUsers.join(", ")}</div>
        <div>Missions: ${selectedMissions.join(", ")}</div>
      </div>
    </div>
    <div style="text-align:right;font-size:10px;color:#94a3b8;line-height:1.8;">
      <div style="font-size:12px;font-weight:700;color:#34d399;">Financial Overview</div>
      <div>Approved: ${approvedList.length} entries</div>
      <div>Rejected: ${rejectedList.length} entries</div>
      <div>Total Records: ${filtered.length}</div>
    </div>
  </div>
</div>
<div class="summary">
  <div class="card"><div class="card-label">Total Approved</div><div class="card-value" style="color:#059669;">${fmt(totalApproved)}</div></div>
  <div class="card"><div class="card-label">Total Received</div><div class="card-value" style="color:#2563eb;">${fmt(totalReceived)}</div></div>
  <div class="card"><div class="card-label">Pending Payable</div><div class="card-value" style="color:${pendingPayable>0?"#dc2626":"#059669"};">${fmt(Math.abs(pendingPayable))}</div></div>
  <div class="card"><div class="card-label">Rejected</div><div class="card-value" style="color:#dc2626;">-${fmt(totalRejected)}</div></div>
</div>

<div class="mission-section">
  <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:8px;">Mission Wise Summary</div>
  ${missionBreakdown.map(md => `
    <div class="mission-card">
      <div class="mission-title">${md.name}</div>
      <div class="mission-stats">
        <span>Employees: <strong>${md.userNames.join(", ")}</strong></span>
        <span>Expenses: <strong>${fmt(md.spent)}</strong></span>
        <span>Received: <strong style="color:#059669">${fmt(md.received)}</strong></span>
        <span>Pending: <strong style="color:${md.pending>0?"#dc2626":"#059669"}">${fmt(Math.abs(md.pending))}</strong></span>
        <span>Records: <strong>${md.expenses.length}</strong></span>
      </div>
    </div>
  `).join("")}
</div>

<div class="table-section">
  <div class="section-header"><div class="section-dot" style="background:#10b981;"></div><div class="section-label" style="color:#059669;">Approved</div><div class="section-count">${approvedList.length} records | ${fmt(totalApproved)}</div></div>
  <table><thead><tr><th>Date</th><th>Employee</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
  <tbody>${buildRows(approvedList, true)}<tr class="total-row"><td colspan="4" style="text-align:right;color:#6b7280;font-size:9px;">APPROVED TOTAL</td><td style="text-align:right;color:#059669;">${fmt(totalApproved)}</td><td colspan="2"></td></tr></tbody></table>
</div>
${rejectedList.length > 0 ? `<div class="table-section" style="padding-top:0;"><div class="section-header"><div class="section-dot" style="background:#ef4444;"></div><div class="section-label" style="color:#dc2626;">Rejected</div><div class="section-count">${rejectedList.length} records</div></div><table><thead><tr><th>Date</th><th>Employee</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>${buildRows(rejectedList, false)}</tbody></table></div>` : ""}
<div class="footer">
  <div style="font-size:9px;color:#94a3b8;"><div style="font-weight:800;color:#374151;font-size:11px;">Final Summary</div><div style="margin-top:3px;">Approved: ${fmt(totalApproved)} | Received: ${fmt(totalReceived)} | Rejected: -${fmt(totalRejected)}</div></div>
  <div style="text-align:right;"><div style="font-size:8px;color:#94a3b8;margin-bottom:2px;">Net Pending</div><div style="font-size:14px;font-weight:900;color:#059669;">${fmt(Math.max(0,pendingPayable))}</div></div>
</div>
</div>
<div class="no-print" style="position:fixed;bottom:24px;right:24px;display:flex;gap:10px;z-index:999;">
  <button onclick="window.print()" style="background:linear-gradient(135deg,#1e3a5f,#0f2444);color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;">PRINT</button>
  <button onclick="window.close()" style="background:#fff;color:#6b7280;border:1px solid #e2e8f0;padding:12px 20px;border-radius:12px;font-size:12px;cursor:pointer;">CLOSE</button>
</div>
<script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body></html>`;
    const w = window.open("", "_blank", "width=960,height=800");
    if (!w) return toast.error("Popup blocked!");
    w.document.write(html); w.document.close();
  };

  return (
    <div className="space-y-3 animate-fade-in pb-24 px-3 relative">

      {/* FILTER PANEL — collapsible accordion */}
      <div className="bg-white rounded-[1.6rem] border border-gray-100 shadow-sm overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3 text-gray-400" />
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Filters</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedUsers.length > 0 && (
              <span className="text-[7px] font-black text-white px-2 py-0.5 rounded-full" style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>
                {selectedUsers.map(u => u.split(" ")[0]).join(", ")}
              </span>
            )}
            {selectedMissions.length > 0 && (
              <span className="text-[7px] font-black text-white px-2 py-0.5 rounded-full" style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>
                {selectedMissions.length} mission{selectedMissions.length > 1 ? "s" : ""}
              </span>
            )}
            {(selectedUsers.length > 0 || selectedMissions.length > 0) && (
              <button onClick={() => { setSelectedUsers([]); setSelectedMissions([]); setStep1Open(false); setStep2Open(false); }}
                className="text-[7px] font-black uppercase text-rose-400 bg-rose-50 px-2 py-1 rounded-full">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Step 1 — Employee accordion */}
        <div className="border-t border-gray-50">
          <button onClick={() => setStep1Open(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[7px] font-black"
              style={{background: selectedUsers.length > 0 ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#e5e7eb"}}>
              {selectedUsers.length > 0 ? "✓" : "1"}
            </div>
            <span className="text-[9px] font-black uppercase text-gray-600 flex-1 text-left">
              Employee
              {selectedUsers.length > 0 && <span className="ml-2 font-bold text-gray-400 normal-case">({selectedUsers.length} selected)</span>}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${step1Open ? "rotate-180" : ""}`} />
          </button>
          {step1Open && (
            <div className="px-3 pb-3 animate-in slide-in-from-top-1 duration-150">
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-1.5">
                {uniqueUsers.map((name: string) => {
                  const sel = selectedUsers.includes(name);
                  return (
                    <button key={name} onClick={() => { toggleUser(name); }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all active:scale-95 ${sel ? "text-white" : "bg-white text-gray-700 border border-gray-100"}`}
                      style={sel ? {background:"linear-gradient(135deg,#2563eb,#1d4ed8)"} : {}}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sel ? "bg-white border-white" : "border-gray-300"}`}>
                        {sel && <div className="w-2 h-2 rounded-full" style={{background:"#2563eb"}} />}
                      </div>
                      <span className="text-[11px] font-black uppercase">{name}</span>
                    </button>
                  );
                })}
              </div>
              {selectedUsers.length > 0 && (
                <button onClick={() => { setStep1Open(false); setStep2Open(true); }}
                  className="w-full mt-2 py-2 text-white text-[8px] font-black uppercase rounded-xl active:scale-95 transition-all"
                  style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>
                  Next → Select Mission
                </button>
              )}
            </div>
          )}
        </div>

        {/* Step 2 — Mission accordion */}
        <div className="border-t border-gray-50">
          <button
            onClick={() => selectedUsers.length > 0 && setStep2Open(o => !o)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${selectedUsers.length === 0 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[7px] font-black"
              style={{background: selectedMissions.length > 0 ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "#e5e7eb"}}>
              {selectedMissions.length > 0 ? "✓" : "2"}
            </div>
            <span className="text-[9px] font-black uppercase text-gray-600 flex-1 text-left">
              Mission
              {selectedMissions.length > 0 && <span className="ml-2 font-bold text-gray-400 normal-case">({selectedMissions.length} selected)</span>}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${step2Open ? "rotate-180" : ""}`} />
          </button>
          {step2Open && selectedUsers.length > 0 && (
            <div className="px-3 pb-3 animate-in slide-in-from-top-1 duration-150">
              <div className="flex flex-col gap-1 max-h-44 overflow-y-auto rounded-xl bg-gray-50 p-1.5">
                {availableMissions.length > 0 && (
                  <button onClick={selectAllMissions}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all active:scale-95 border-2 ${
                      selectedMissions.length === availableMissions.length ? "text-white border-transparent" : "bg-white text-gray-600 border-dashed border-gray-200"
                    }`}
                    style={selectedMissions.length === availableMissions.length ? {background:"linear-gradient(135deg,#7c3aed,#6d28d9)"} : {}}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedMissions.length === availableMissions.length ? "bg-white border-white" : "border-gray-300"}`}>
                      {selectedMissions.length === availableMissions.length && <div className="w-2 h-2 rounded-full" style={{background:"#7c3aed"}} />}
                    </div>
                    <span className="text-[10px] font-black uppercase flex-1">All Missions</span>
                    <span className={`text-[7px] font-bold ${selectedMissions.length === availableMissions.length ? "text-white/60" : "text-gray-400"}`}>{availableMissions.length}</span>
                  </button>
                )}
                {availableMissions.map((m: string) => {
                  const sel = selectedMissions.includes(m);
                  return (
                    <button key={m} onClick={() => toggleMission(m)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all active:scale-95 ${sel ? "text-white" : "bg-white text-gray-700 border border-gray-100"}`}
                      style={sel ? {background:"linear-gradient(135deg,#7c3aed,#6d28d9)"} : {}}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sel ? "bg-white border-white" : "border-gray-300"}`}>
                        {sel && <div className="w-2 h-2 rounded-full" style={{background:"#7c3aed"}} />}
                      </div>
                      <span className="text-[10px] font-black uppercase truncate flex-1">{m}</span>
                    </button>
                  );
                })}
                {availableMissions.length === 0 && <p className="text-[8px] text-gray-400 text-center py-3 font-bold">No missions found</p>}
              </div>
              {selectedMissions.length > 0 && (
                <button onClick={() => setStep2Open(false)}
                  className="w-full mt-2 py-2 text-white text-[8px] font-black uppercase rounded-xl active:scale-95 transition-all"
                  style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>
                  Done — View Report ↓
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category + Status — only when data ready */}
        {hasData && (
          <div className="border-t border-gray-50 grid grid-cols-2 gap-2 px-3 py-3">
            <div className="relative">
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="w-full bg-gray-50 p-2.5 rounded-xl text-[8px] font-black uppercase outline-none appearance-none border border-gray-100">
                <option value="all">All Categories</option>
                {["travel","meal","hotel","luggage","other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <LayoutGrid className="absolute right-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-gray-50 p-2.5 rounded-xl text-[8px] font-black uppercase outline-none appearance-none border border-gray-100">
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select>
              <Activity className="absolute right-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* EMPTY STATE */}
      {!hasData ? (
        <div className="rounded-[1.6rem] p-8 text-center text-white" style={{background:"linear-gradient(135deg,#1e3a5f,#0f2444)"}}>
          {selectedUsers.length === 0 ? (
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{background:"rgba(255,255,255,0.1)"}}>
                <span className="text-lg">👤</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Select Employee</p>
              <p className="text-[8px] text-white/40">Step 1 — Choose employee(s) above</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{background:"rgba(255,255,255,0.1)"}}>
                <span className="text-lg">🚀</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Select Mission(s)</p>
              <p className="text-[8px] text-white/40">Step 2 — Pick one or more missions</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* OVERALL SUMMARY CARD */}
          <div className="rounded-[1.6rem] p-4 text-white relative overflow-hidden" style={{background:"linear-gradient(135deg,#1e3a5f,#0f2444)"}}>
            {/* User + Mission tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedUsers.map(u => (
                <span key={u} className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full" style={{background:"rgba(255,255,255,0.12)"}}>👤 {u}</span>
              ))}
              {selectedMissions.map(m => (
                <span key={m} className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full" style={{background:"rgba(124,58,237,0.4)"}}>🚀 {m}</span>
              ))}
            </div>

            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[7px] font-black uppercase tracking-[0.3em] text-emerald-400 opacity-80 mb-0.5">Total Approved</p>
                <h2 className="text-3xl font-black tracking-tighter">{fmt(totalApproved)}</h2>
              </div>
              <div className="p-2 rounded-xl" style={{background:"rgba(255,255,255,0.1)"}}>
                <BarChart3 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 border-t border-white/10 pt-3">
              {[
                {label:"Received", val:fmt(totalReceived), color:"text-emerald-400"},
                {label:"Rejected", val:fmt(totalRejected), color:"text-rose-400"},
                {label:"Pending", val:fmt(Math.abs(pendingPayable)), color: pendingPayable > 0 ? "text-amber-400" : "text-emerald-400"},
                {label:"Records", val:String(filtered.length), color:"text-white"},
              ].map(s => (
                <div key={s.label} className="rounded-xl p-2 text-center" style={{background:"rgba(255,255,255,0.06)"}}>
                  <p className="text-[6px] font-black uppercase text-white/30 mb-1">{s.label}</p>
                  <p className={`text-[9px] font-black ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Subtle bars */}
            <div className="absolute bottom-0 left-0 right-0 h-8 opacity-10 flex items-end gap-0.5 px-4">
              {[40,70,45,90,65,80,30,50,85,40].map((h,i) => <div key={i} className="flex-1 bg-white rounded-t-sm" style={{height:`${h}%`}} />)}
            </div>
          </div>

          {/* MISSION-WISE CARDS */}
          <div className="space-y-2">
            <p className="text-[7px] font-black uppercase opacity-40 tracking-widest px-1">Mission Wise Breakdown</p>
            {missionBreakdown.map((md: any) => {
              const isOpen = expandedMission === md.name;
              return (
                <div key={md.name} className="bg-white rounded-[1.4rem] border border-gray-100 shadow-sm overflow-hidden">
                  {/* Mission header */}
                  <button onClick={() => setExpandedMission(isOpen ? null : md.name)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[10px] font-black uppercase text-gray-900 truncate">{md.name}</p>
                      <p className="text-[7px] text-gray-400 font-bold truncate">{md.userNames.join(", ")}</p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-1">
                      <p className="text-[12px] font-black text-gray-900">{fmt(md.spent)}</p>
                      <p className="text-[7px] text-gray-400">{md.expenses.length} records</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                  </button>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="border-t border-gray-50 bg-gray-50 px-4 py-3 space-y-3 animate-in slide-in-from-top-1 duration-150">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
                          <p className="text-[6px] font-black uppercase text-gray-400">Expenses</p>
                          <p className="text-[11px] font-black text-gray-900 mt-0.5">{fmt(md.spent)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-2.5 text-center border border-emerald-100">
                          <p className="text-[6px] font-black uppercase text-emerald-500">Received</p>
                          <p className="text-[11px] font-black text-emerald-700 mt-0.5">{fmt(md.received)}</p>
                        </div>
                        <div className={`rounded-xl p-2.5 text-center border ${md.pending > 0 ? "bg-white border-rose-100" : "bg-white border-emerald-100"}`}>
                          <p className={`text-[6px] font-black uppercase ${md.pending > 0 ? "text-rose-400" : "text-emerald-500"}`}>Pending</p>
                          <p className={`text-[11px] font-black mt-0.5 ${md.pending > 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmt(Math.abs(md.pending))}</p>
                        </div>
                      </div>

                      {/* Expense rows */}
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {md.expenses.slice(0, 20).map((e: any, i: number) => (
                          <div key={i} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2.5 border border-gray-100">
                            {e.image_url ? (
                              <div onClick={() => setSelectedPreviewImage(e.image_url)}
                                className="w-8 h-8 rounded-lg border border-gray-100 overflow-hidden cursor-pointer flex-shrink-0">
                                <img src={e.image_url} className="w-full h-full object-cover" alt="r" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="w-2.5 h-2.5 text-gray-300" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[8px] font-black text-gray-400">{e.date} · {e.profiles?.name}</p>
                              <p className="text-[9px] font-bold text-gray-800 truncate">{e.description || "No description"}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[10px] font-black text-gray-900">{fmt(Number(e.amount))}</p>
                              <span className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                e.status === "approved" ? "bg-emerald-50 text-emerald-600"
                                : e.status === "rejected" ? "bg-rose-50 text-rose-500"
                                : "bg-amber-50 text-amber-500"
                              }`}>{e.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Export buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportExcel}
              className="py-3.5 text-white rounded-[1.2rem] font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{background:"linear-gradient(135deg,#059669,#047857)"}}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={printReport}
              className="py-3.5 text-white rounded-[1.2rem] font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{background:"linear-gradient(135deg,#1e3a5f,#0f2444)"}}>
              <Printer className="w-4 h-4" /> Print Report
            </button>
          </div>
        </>
      )}

      <ImagePreviewModal imageUrl={selectedPreviewImage} onClose={() => setSelectedPreviewImage(null)} />
    </div>
  );
}