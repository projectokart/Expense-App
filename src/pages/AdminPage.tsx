
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import ImagePreviewModal from "@/components/expense/ImagePreviewModal";
import { 
  // 🧭 Navigation & Action Icons
  User, 
  ImageIcon,
  Users,
  ChevronDown, 
  ArrowLeft,
  Filter, 
  Loader2,
  Search,
  Calendar,
  Trash2,
  UserIcon,
  ArrowDown,
  ArrowUp,
  
  // 📊 Analytics & Reports Icons
  BarChart3, 
  FileSpreadsheet, 
  Target, 
  LayoutGrid, 
  Activity, 
  
  // 📂 Category Specific Icons
  Car, 
  Utensils, 
  Hotel, 
  Briefcase, 
  
  // 💰 Finance Icons
  DollarSign, 
  Wallet,
  
  // 🛡️ Admin & Status Icons
  Settings2, 
  Settings,
  ShieldCheck, 
  Shield,
  CheckCircle, 
  XCircle,
RefreshCw
} from 'lucide-react';

// 1. Added "settlements" to Tab type
type Tab = "expenses" | "users" | "limits" | "reports" | "settlements";



export default function AdminPage() {


  
  // Nayi states jo preview aur deferred upload handle karengi
const [previewUrl, setPreviewUrl] = useState<string>('');
const [tempFile, setTempFile] = useState<File | null>(null);
const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState<boolean>(false); // Agar pehle se nahi hai toh
  // 1. Ek hi baar useAuth() se sab nikaalein (No more redeclare errors)
  // Is line ko replace karein (Ensure names match exactly)
// Is line ko update karein
const [searchFilters, setSearchFilters] = useState({
  searchQuery: "",
  userEmail: "all",
  missionName: "all",
  category: "all", // 👈 Ye missing hai, ise add karein
  startDate: "",
  endDate: "",
  status: "all"
});

// Is line ko dhundo aur replace karo
const [filters, setFilters] = useState({ 
  category: 'all', 
  status: 'all', 
  userId: 'all', 
  missionId: 'all' 
});

  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
// Inhe baaki states ke saath add karein
const [selectedExpense, setSelectedExpense] = useState<any>(null);
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // 2. Standard States
  const [tab, setTab] = useState<Tab>("expenses");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 3. Advanced Logic States
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [userMissions, setUserMissions] = useState<any[]>([]);
  

  // 4. New Settlement States
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleData, setSettleData] = useState({
    userId: "",
    missionId: "all",
    amountType: "full", 
    amount: 0,
    proofUrl: "",
    note: "" // <--- Ye line add kar do
});

  // 5. Super Admin Config
  const SUPER_ADMIN_EMAIL = "dev@gmail.com";

  useEffect(() => {
    loadData();
  }, []);

const loadData = async () => {
  setLoading(true);
  try {
    console.log("Fetching data using original database columns...");

    const [expRes, usrRes, limRes, setRes, missRes] = await Promise.all([
      // Sirf wahi columns jo aapke DB mein hain
      supabase.from("expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select(`*, user_roles (role)`),
      supabase.from("category_limits").select("*"),
      supabase.from("settlements").select("*"),
      supabase.from("missions").select("*")
    ]);

    if (expRes.error) throw expRes.error;

    // --- Manual Mapping using existing IDs ---
    const enrichedExpenses = (expRes.data || []).map(expense => {
      // expense.user_id se profile dhundo
      const userProfile = (usrRes.data || []).find(u => u.id === expense.user_id);
      // expense.mission_id se mission dhundo
      const missionData = (missRes.data || []).find(m => m.id === expense.mission_id);
      
      return {
        ...expense,
        // Hum extra properties add kar rahe hain mapping ke liye
        // Lekin original columns (user_id, mission_id) ko nahi chedenge
        profiles: userProfile || null,
        missions: missionData || null
      };
    });

    setExpenses(enrichedExpenses);
    setUsers(usrRes.data || []);
    setLimits(limRes.data || []);
    setSettlements(setRes.data || []);
    
    if (typeof setUserMissions === 'function') {
      setUserMissions(missRes.data || []);
    }

    console.log("Data Mapped Successfully ✅");

  } catch (err: any) {
    console.error("Load Error:", err.message);
    toast.error("Fetch Fail: " + err.message);
  } finally {
    setLoading(false);
  }
};
  // --- Logic Functions ---
  

// 1. Master Logic: Approve (with Edit & Note)
const approveExpense = async (expenseId: string) => {
  const expense = expenses.find(e => e.id === expenseId);
  if (!expense) return;

  // Amount Edit & Admin Note via prompts
  const newAmount = prompt(`Current: ₹${expense.amount}. Edit amount?`, expense.amount.toString());
  if (newAmount === null) return;

  const adminNote = prompt("Add a note for the user:", "Approved by admin.");

  try {
    const { error } = await supabase.from("expenses").update({
      status: "approved",
      amount: parseFloat(newAmount),
      admin_note: adminNote,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", expenseId);

    if (error) throw error;

    toast.success("Expense Approved!");
    loadData(); // Sync with DB
  } catch (err: any) {
    toast.error(err.message);
  }
};

// 2. Master Logic: Reject (with Reason)
const rejectExpense = async (expenseId: string) => {
  const reason = prompt("Rejection reason:");
  if (reason === null) return; // User cancelled

  try {
    const { error } = await supabase.from("expenses").update({
      status: "rejected",
      admin_note: reason, 
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", expenseId);

    if (error) throw error;

    toast.success("Expense rejected");
    loadData();
  } catch (err: any) {
    toast.error(err.message);
  }
};

// 3. Status Toggle (Approved ko Reject karne ke liye)
const updateExpenseStatus = async (expense: any, nextStatus: 'approved' | 'rejected') => {
  if (nextStatus === 'approved') {
    await approveExpense(expense.id);
  } else {
    await rejectExpense(expense.id);
  }
};

// 4. Delete Logic
// 1. Loading state (Component ke top par add karein agar nahi hai)
const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

// 2. Optimized Delete Function
const deleteExpense = async (id: string) => {
  // Desi touch with professional warning
  const confirmDelete = window.confirm("⚠️ Bhai, delete kar diya toh wapis nahi aayega. Sure ho?");
  if (!confirmDelete) return;

  setIsActionLoading(id); // Button ko disable karne ke liye
  try {
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    toast.success("Record Deleted! 🗑️");
    // Local state se turant remove karein taaki UI fast lage
    loadData(); 
  } catch (err: any) {
    toast.error(err.message || "Delete fail ho gaya!");
    console.error("Delete Error:", err);
  } finally {
    setIsActionLoading(null);
  }
};

  // 4. Added Settlement Record Function
 const handleFinalSettle = async (uploadedUrl?: string) => {
  // Ab hum check karenge ya to pehle se URL ho (rare) ya humne abhi upload kiya ho
  const finalProofUrl = uploadedUrl || settleData.proofUrl;

  if (!settleData.amount || !finalProofUrl) {
    return toast.error("Amount and Proof are mandatory!");
  }

  setLoading(true);
  try {
    const { error } = await supabase.from("settlements").insert({
      user_id: selectedUser,
      mission_id: settleData.missionId === "all" ? null : settleData.missionId,
      amount: settleData.amount,
      proof_url: finalProofUrl, // Yahan humne dynamic URL use kiya hai
      settled_by: user?.id,
      user_acknowledged: false,
      note: settleData.note // Ye line bhi add kar lena taaki remark save ho jaye
    });

    if (error) throw error;

    toast.success("Account Settled Successfully!");
    
    // ✅ Form Reset with clean state
    setSettleData({ ...settleData, amount: 0, proofUrl: "", note: "" });
    setPreviewUrl(''); // Preview saaf karein
    setTempFile(null); // File saaf karein
    setIsSettleModalOpen(false); // Modal band karein
    
    loadData(); // Refresh UI
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setLoading(false);
  }
};

  // Loading state handle karne ke liye (top par add karein agar nahi hai)
const [isUpdating, setIsUpdating] = useState<string | null>(null);

const updateLimit = async (id: string, newLimit: number) => {
  setIsUpdating(id); // Input ko disable/loading dikhane ke liye
  
  try {
    const { error } = await supabase
      .from("category_limits")
      .update({
        daily_limit: newLimit,
        updated_by: user?.id,
        updated_at: new Date().toISOString(), // Track kab update hua
      })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Limit updated!");
      // Local state update karein ya loadData() call karein
      if (typeof loadData === 'function') loadData(); 
    }
  } catch (err) {
    toast.error("An unexpected error occurred");
  } finally {
    setIsUpdating(null); // Loading khatam
  }
};


const toggleUserRole = async (targetUser: any, newRole: string) => {
  if (targetUser.email === SUPER_ADMIN_EMAIL) {
    toast.error("Owner cannot be modified!");
    return;
  }

  try {
    const { error } = await supabase
      .from("user_roles")
      .upsert({ 
        user_id: targetUser.id, 
        role: newRole as any 
      }, { onConflict: 'user_id' });

    if (error) throw error;

    // 🔥 Yeh line important hai: Yeh UI ko bina refresh kiye update karegi
    setUsers(prevUsers => prevUsers.map(u => 
      u.id === targetUser.id 
        ? { ...u, user_roles: [{ role: newRole }] } 
        : u
    ));

    toast.success(`${targetUser.name || 'User'} is now ${newRole.toUpperCase()}`);
    
  } catch (err: any) {
    toast.error("Failed to update role");
  }
};

const approveUser = async (target: any) => {
  // 1. Check if target is object or just ID
  const targetId = typeof target === 'string' ? target : target.id;
  const targetName = typeof target === 'string' ? "User" : (target.name || "User");

  // Security Check
  if (role !== 'admin' && user?.email !== SUPER_ADMIN_EMAIL) {
    toast.error("Aapke paas permission nahi hai!");
    return;
  }

  try {
    // 2. Profile approve karo (Database)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_approved: true })
      .eq("id", targetId);

    if (profileError) throw profileError;

    // 3. Default Role assign karo (Agar pehle se nahi hai)
    // Isse user login karte hi dashboard access kar payega
    const { error: roleError } = await supabase.from("user_roles").upsert({ 
      user_id: targetId, 
      role: 'user' 
    }, { onConflict: 'user_id' });

    if (roleError) console.warn("Role upsert issue:", roleError.message);

    // 4. UI Update (Bina page refresh kiye)
    setUsers(prevUsers => prevUsers.map(u => 
      u.id === targetId 
        ? { 
            ...u, 
            is_approved: true, 
            // Agar user_roles khali hai toh default 'user' dikhao
            user_roles: u.user_roles?.length > 0 ? u.user_roles : [{ role: 'user' }] 
          } 
        : u
    ));
    
    toast.success(`${targetName} Approved Successfully! ✅`);
    
    // Background refresh data to stay in sync
    loadData(); 
    
  } catch (err: any) {
    console.error("Approval fail:", err.message);
    toast.error("Approval fail: " + err.message);
  }
};

// Iska naam exportCSV kar do taaki purane buttons kaam karne lagein
const exportCSV = () => { 
  if (expenses.length === 0) return toast.error("No data to export");

  // 1. Filtering Logic (Same as your code)
  const filteredData = expenses.filter(e => {
    const matchCategory = filters.category === 'all' || e.category === filters.category;
    const matchStatus = filters.status === 'all' || e.status === filters.status;
    const matchUser = selectedUser === "" || e.user_id === selectedUser;
    return matchCategory && matchStatus && matchUser;
  });

  if (filteredData.length === 0) return toast.error("No data matches your filters");

  // 2. Formatting (Using XLSX)
  const excelRows = filteredData.map(e => ({
    "Date": e.date,
    "Employee": e.profiles?.name || "N/A",
    "Category": e.category.toUpperCase(),
    "Description": e.description || "",
    "Amount (₹)": Number(e.amount),
    "Status": e.status.toUpperCase()
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
  
  // 3. Download
  XLSX.writeFile(workbook, `Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  toast.success(`Excel exported!`);
};

  // 5. Added Settlements to tabs array
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "expenses", label: "Expenses", icon: <DollarSign className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { key: "settlements", label: "Settlements", icon: <Wallet className="w-4 h-4" /> },
    { key: "limits", label: "Limits", icon: <Settings className="w-4 h-4" /> },
    { key: "reports", label: "Reports", icon: <BarChart3 className="w-4 h-4" /> },
  ];
//6
const uploadSettlementProof = async (file: File) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `proofs/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('settlement-proofs')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get Public URL to save in database
    const { data: { publicUrl } } = supabase.storage
      .from('settlement-proofs')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error: any) {
    toast.error("Upload failed: " + error.message);
    return null;
  }
};

// --- 1. SMART UNIQUE LISTS (LOGIC CHANGE) ---
// Ye dropdowns ko interconnected banayega bina UI chede

// --- 1. SMART UNIQUE LISTS (ONE-WAY DEPENDENCY) ---

// UNIQUE USERS: Mission select karne par ye list change NAHI hogi (Hamesha saare users dikhenge)
const uniqueUsers = useMemo(() => {
  return Array.from(
    new Set(expenses.map((e) => e.profiles?.name).filter(Boolean))
  );
}, [expenses]); // Dependency se missionName hata diya taaki users filter na hon

// UNIQUE MISSIONS: User select karne par ye list SMARTly change hogi
const uniqueMissions = useMemo(() => {
  let list = expenses;
  // Agar koi user select kiya hai, toh sirf uske missions dropdown mein dikhao
  if (searchFilters.userEmail !== "all") {
    list = list.filter(e => e.profiles?.name === searchFilters.userEmail);
  }
  return Array.from(
    new Set(list.map((e) => e.missions?.name).filter(Boolean))
  );
}, [expenses, searchFilters.userEmail]); // User selection badalne par update hoga

const categories = ["travel", "luggage", "hotel", "meal", "other"];

// --- 2. MAIN FILTERING LOGIC (STAYS THE SAME) ---
const filteredExpenses = expenses
  .filter((e) => {
    // A. Search Bar
    const query = searchFilters.searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      (e.profiles?.name || "").toLowerCase().includes(query) ||
      (e.description || "").toLowerCase().includes(query) ||
      (e.category || "").toLowerCase().includes(query);

    // B. User Match
    const matchesUser =
      searchFilters.userEmail === "all" ||
      e.profiles?.name === searchFilters.userEmail;

    // C. Mission Match
    const matchesMission =
      searchFilters.missionName === "all" ||
      e.missions?.name === searchFilters.missionName;

    // D. Category Match
    const matchesCategory =
      searchFilters.category === "all" || 
      e.category === searchFilters.category;

    // E. Status Match
    const matchesStatus =
      searchFilters.status === "all" || 
      e.status === searchFilters.status;

    // F. Date Range Logic
    const expDate = e.date ? new Date(e.date).setHours(0, 0, 0, 0) : null;
    const start = searchFilters.startDate ? new Date(searchFilters.startDate).setHours(0, 0, 0, 0) : null;
    const end = searchFilters.endDate ? new Date(searchFilters.endDate).setHours(0, 0, 0, 0) : null;

    const matchesDate =
      (!start || (expDate && expDate >= start)) &&
      (!end || (expDate && expDate <= end));

    return (
      matchesSearch &&
      matchesUser &&
      matchesMission &&
      matchesCategory &&
      matchesStatus &&
      matchesDate
    );
  })


  .sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
const filtered = useMemo(() => {
  if (!expenses || expenses.length === 0) return [];

  return expenses.filter((e) => {
    // A. User Match (Exact same as your expense sheet)
    const matchesUser =
      filters.userId === "all" ||
      e.profiles?.name === filters.userId;

    // B. Mission Match (Using e.missions?.name as per your logic)
    const matchesMission =
      filters.missionId === "all" ||
      e.missions?.name === filters.missionId;

    // C. Category Match
    const matchesCategory =
      filters.category === "all" || 
      e.category === filters.category;

    // D. Status Match
    const matchesStatus =
      filters.status === "all" || 
      e.status === filters.status;

    // Sabhi conditions meet honi chahiye
    return matchesUser && matchesMission && matchesCategory && matchesStatus;
  })
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}, [expenses, filters]);




const uniqueMissionsReport = useMemo(() => {
  let list = expenses;
  // Agar koi employee select hai, toh sirf uske missions dikhao
  if (filters.userId !== "all") {
    list = list.filter(e => e.profiles?.name === filters.userId);
  }
  return Array.from(
    new Set(list.map((e) => e.missions?.name).filter(Boolean))
  );
}, [expenses, filters.userId]);
















  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header (Design kept same) */}
      <div className="bg-foreground p-5 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => navigate("/")} className="text-background/60 hover:text-background transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black italic tracking-tighter text-background">Admin Panel</h1>
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-nowrap gap-1 w-full overflow-hidden items-stretch px-1">
  {tabs.map(t => (
    <button
      key={t.key}
      onClick={() => setTab(t.key)}
      /* min-w-0 aur flex-1 ensures perfect horizontal fit without scroll */
      className={`flex-1 min-w-0 py-2.5 rounded-xl text-[7px] font-black uppercase tracking-tighter flex flex-col items-center justify-center gap-1 transition-all border ${
        tab === t.key 
          ? "bg-primary text-primary-foreground border-transparent shadow-sm scale-[1.02]" 
          : "bg-background/10 text-background/40 border-transparent"
      }`}
    >
      {/* Icon size ko bhi thoda compact kiya hai taaki label ke liye jagah bache */}
      <span className="scale-75 origin-center">
        {t.icon}
      </span>
      <span className="truncate w-full text-center px-0.5">
        {t.label}
      </span>
    </button>
  ))}
</div>
      </div>

      <div className="p-4 pb-24">
        {/* Expenses Tab - Same as your code */}
{tab === "expenses" && (
  <div className="space-y-3 pb-24 animate-fade-in bg-gray-50/50 min-h-screen">
    


    {/* --- PREMIUM ULTRA-COMPACT FILTER PANEL --- */}
{/* --- GOOGLE PREMIUM FLOATING FILTER PANEL --- */}
<div className="mx-4 mb-6">
  <div className="bg-[#F8F9FA] p-1.5 rounded-[2.5rem] shadow-inner border border-gray-100/50">
    <div className="bg-white p-5 rounded-[2.3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
      
      {/* Search Bar - Minimalist */}
      <div className="flex gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#4285F4] transition-colors" />
          <input 
            type="text" 
            placeholder="Search records..."
            className="w-full bg-[#F1F3F4]/50 text-[12px] pl-10 pr-4 py-3 rounded-2xl outline-none font-medium border-2 border-transparent focus:bg-white focus:border-[#4285F4]/10 transition-all placeholder:text-gray-400"
            value={searchFilters.searchQuery}
            onChange={(e) => setSearchFilters({...searchFilters, searchQuery: e.target.value})}
          />
        </div>
        <button 
          onClick={() => setSearchFilters({
            searchQuery: "", userEmail: "all", missionName: "all", 
            category: "all", startDate: "", endDate: "", status: "all"
          })}
          className="bg-[#F1F3F4] hover:bg-rose-50 hover:text-[#EA4335] p-3 rounded-2xl transition-all active:scale-90 flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Selects Row - No Backgrounds, Only Dividers */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-y border-gray-50 py-1">
        {/* User */}
        <div className="relative px-2 group">
          <select 
            className="w-full bg-transparent text-[10px] py-2 pl-6 outline-none font-bold text-gray-700 appearance-none cursor-pointer"
            value={searchFilters.userEmail}
            onChange={(e) => setSearchFilters({...searchFilters, userEmail: e.target.value})}
          >
            <option value="all">Personnel</option>
            {uniqueUsers.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4285F4] opacity-50" />
        </div>
        
        {/* Mission */}
        <div className="relative px-2 group">
          <select 
            className="w-full bg-transparent text-[10px] py-2 pl-6 outline-none font-bold text-gray-700 appearance-none cursor-pointer"
            value={searchFilters.missionName}
            onChange={(e) => setSearchFilters({...searchFilters, missionName: e.target.value})}
          >
            <option value="all">Mission</option>
            {uniqueMissions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <Target className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-500/50" />
        </div>

        {/* Category */}
        <div className="relative px-2 group">
          <select 
            className="w-full bg-transparent text-[10px] py-2 pl-6 outline-none font-bold text-gray-700 appearance-none cursor-pointer capitalize"
            value={searchFilters.category}
            onChange={(e) => setSearchFilters({...searchFilters, category: e.target.value})}
          >
            <option value="all">Category</option>
            {["travel", "meal", "hotel", "luggage", "other"].map(cat => (
              <option key={cat} value={cat}>{cat.toUpperCase()}</option>
            ))}
          </select>
          <LayoutGrid className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#34A853] opacity-50" />
        </div>
      </div>

      {/* Date & Status - Bottom Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-1">
        {/* Date Inputs */}
        <div className="flex items-center gap-2 bg-[#F1F3F4]/50 p-1 rounded-xl">
          <div className="flex items-center px-2 py-1 gap-1.5">
            <Calendar className="w-2.5 h-2.5 text-gray-400" />
            <input 
              type="date" 
              className="bg-transparent text-[9px] font-bold text-gray-500 outline-none w-24"
              value={searchFilters.startDate}
              onChange={(e) => setSearchFilters({...searchFilters, startDate: e.target.value})}
            />
          </div>
          <div className="w-[1px] h-3 bg-gray-300" />
          <div className="flex items-center px-2 py-1">
            <input 
              type="date" 
              className="bg-transparent text-[9px] font-bold text-gray-500 outline-none w-24"
              value={searchFilters.endDate}
              onChange={(e) => setSearchFilters({...searchFilters, endDate: e.target.value})}
            />
          </div>
        </div>

        {/* Status Pills - Fixed to Google Colors */}
        <div className="flex flex-nowrap gap-1 w-full overflow-hidden">
  {['all', 'pending', 'approved', 'rejected'].map((s) => {
    const isActive = searchFilters.status === s;
    const googleColors: any = {
      all: isActive ? 'bg-gray-800 text-white' : 'bg-white text-gray-400',
      pending: isActive ? 'bg-[#FBBC05] text-white' : 'bg-white text-gray-400 hover:text-[#FBBC05]',
      approved: isActive ? 'bg-[#34A853] text-white' : 'bg-white text-gray-400 hover:text-[#34A853]',
      rejected: isActive ? 'bg-[#EA4335] text-white' : 'bg-white text-gray-400 hover:text-[#EA4335]'
    };

    return (
      <button
        key={s}
        onClick={() => setSearchFilters({...searchFilters, status: s})}
        /* flex-1 aur text-[7px] ensure karenge ki sab ek hi line mein rahein */
        className={`flex-1 min-w-0 py-2 rounded-full text-[7px] font-black uppercase transition-all border border-gray-100 truncate ${googleColors[s]} ${isActive ? 'shadow-sm border-transparent scale-105' : ''}`}
      >
        {s}
      </button>
    )
  })}
</div>
      </div>
    </div>
  </div>
</div>






    {/* --- Results & Export --- */}
    <div className="px-5 flex justify-between items-center">
      <span className="text-[8px] font-black uppercase opacity-30 tracking-[0.2em]">{filteredExpenses.length} Records found</span>
      <button onClick={exportCSV} className="text-green-600 text-[8px] font-black uppercase border border-green-100 px-2 py-1 rounded-md">CSV ↓</button>
    </div>

    {/* --- Expense Cards --- */}
    <div className="space-y-2.5 px-3">
  {filteredExpenses.map((e) => {
    const userName = e.profiles?.name || e.user_name || "Unknown User";
    const receiptImage = e.image_url;

    return (
      <div 
        key={e.id} 
        className="bg-white p-3.5 rounded-[1.6rem] border border-gray-50 shadow-sm relative overflow-hidden transition-all hover:shadow-md"
      >
        {/* Header: User Info & Amount */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex gap-2.5">
            {/* User Initial Circle - Slightly Smaller */}
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 text-[10px] border border-slate-100 flex-shrink-0">
              {userName.charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[8px] font-black text-primary uppercase tracking-wider">
                  {userName}
                </p>
                <span className="text-[7px] font-bold text-gray-300">• {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
              </div>
              <h4 className="text-[11px] font-bold text-gray-800 line-clamp-1 leading-tight">
                {e.description || "No Description"}
              </h4>

              {/* 📸 IMAGE SECTION: Compact Preview */}
              {receiptImage ? (
                <div
                  onClick={() => setSelectedPreviewImage(receiptImage)}
                  className="mt-1.5 w-11 h-11 rounded-xl border border-slate-100 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/10 transition-all group relative bg-slate-50"
                >
                  <img
                    src={receiptImage}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    alt="Receipt"
                  />
                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[6px] font-black text-white bg-black/40 px-1 py-0.5 rounded">VIEW</span>
                  </div>
                </div>
              ) : (
                <p className="text-[7px] font-bold text-slate-300 uppercase italic mt-1">No Receipt</p>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="font-black text-[13px] text-gray-900 leading-none">
              ₹{Number(e.amount).toLocaleString()}
            </p>
            <span
              className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md inline-block mt-1.5 ${
                e.status === "pending"
                  ? "bg-amber-50 text-amber-500"
                  : e.status === "approved"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {e.status}
            </span>
          </div>
        </div>

        {/* Actions Area - Slimmer & Tight */}
        <div className="flex gap-2 border-t border-slate-50 pt-3 mt-1.5">
          {e.status === "pending" ? (
            <>
              <button
                onClick={() => approveExpense(e.id)}
                className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white rounded-[1rem] text-[9px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all"
              >
                <CheckCircle className="w-3 h-3" /> Approve
              </button>
              <button
                onClick={() => rejectExpense(e.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 text-rose-500 rounded-[1rem] text-[9px] font-black uppercase tracking-wider border border-rose-100 active:scale-95 transition-all"
              >
                <XCircle className="w-3 h-3" /> Reject
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                e.status === "approved" ? rejectExpense(e.id) : approveExpense(e.id)
              }
              className={`flex-[3] flex items-center justify-center gap-1.5 py-2.5 rounded-[1rem] text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                e.status === "approved"
                  ? "bg-amber-50 text-amber-600 border border-amber-100"
                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              {e.status === "approved" ? "Revert to Reject" : "Mark as Approved"}
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm("Delete?")) deleteExpense(e.id);
            }}
            className="w-9 h-9 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-[1rem] flex items-center justify-center border border-transparent hover:border-rose-100 active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  })}

  <ImagePreviewModal
    imageUrl={selectedPreviewImage}
    onClose={() => setSelectedPreviewImage(null)}
  />
</div>
  </div>
)}
        {/* 6. Added Settlements Tab Content with matching design */}
        
{tab === "settlements" && (
  <div className="space-y-4 animate-fade-in pb-24 px-3 relative">
    
    {/* 📊 1. GLOBAL COMPANY OVERVIEW (Hamesha Visible) */}
    {(() => {
      const gExp = expenses?.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0) || 0;
      const gRec = settlements?.reduce((s, c) => s + Number(c.amount), 0) || 0;
      const gNet = gExp - gRec;

      return (
        <div className="bg-gray-900 rounded-[2rem] p-5 text-white shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-3">
             <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 opacity-80">Company Balance Sheet</p>
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          <div className="flex justify-between items-end">
             <div>
                <p className="text-[8px] font-bold uppercase opacity-40 mb-1 tracking-widest">Total Net Pending</p>
                <h2 className="text-3xl font-black italic tracking-tighter">₹{gNet.toLocaleString()}</h2>
             </div>
             <div className="text-right space-y-1 pb-1">
                <div className="flex justify-end gap-2 items-center">
                  <span className="text-[7px] font-black opacity-30 uppercase">Total Exp</span>
                  <span className="text-[10px] font-bold tracking-tight text-white/90">₹{gExp.toLocaleString()}</span>
                </div>
                <div className="flex justify-end gap-2 items-center">
                  <span className="text-[7px] font-black opacity-30 uppercase">Total Paid</span>
                  <span className="text-[10px] font-bold tracking-tight text-white/90">₹{gRec.toLocaleString()}</span>
                </div>
             </div>
          </div>
        </div>
      );
    })()}

    {/* 👥 2. EMPLOYEE SELECTOR (Compact) */}
    <div className="bg-white p-2 rounded-[1.8rem] border border-gray-100 shadow-sm">
      <select 
        value={selectedUser}
        onChange={(e) => {
          const uId = e.target.value;
          setSelectedUser(uId);
          setSettleData({ ...settleData, userId: uId, missionId: 'all', amount: 0, note: '', proofUrl: '' });
          setPreviewUrl('');
          setTempFile(null);
        }}
        className="w-full p-4 bg-gray-50 rounded-[1.4rem] text-[11px] font-black uppercase outline-none text-center tracking-widest border-2 border-transparent focus:border-gray-200 transition-all"
      >
        <option value="">— Select Employee —</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
      </select>
    </div>

    {/* 📋 3. USER SPECIFIC DATA (Shows on Selection) */}
    {selectedUser && (() => {
      const uExp = expenses.filter(e => e.user_id === selectedUser && e.status === 'approved');
      const uSet = settlements.filter(s => s.user_id === selectedUser);
      const uSpent = uExp.reduce((s, e) => s + Number(e.amount), 0);
      const uRecv = uSet.reduce((s, c) => s + Number(c.amount), 0);
      const uBal = uSpent - uRecv;

      return (
        <div className="space-y-4 animate-in slide-in-from-bottom-3 duration-300">
          
          {/* USER SUMMARY CARD */}
          <div className={`p-5 rounded-[2.2rem] shadow-lg relative overflow-hidden transition-all ${uBal > 0 ? 'bg-red-500' : 'bg-emerald-600'} text-white`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[8px] font-black uppercase opacity-60 mb-1 tracking-widest italic">Personal Outstanding</p>
                <h3 className="text-4xl font-black italic tracking-tighter">₹{Math.abs(uBal).toLocaleString()}</h3>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => { setSettleData({...settleData, amountType: 'add_money', amount: 0}); setIsSettleModalOpen(true); }}
                  className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-white/20 active:scale-90 transition-all"
                > + Add </button>
                <button 
                  onClick={() => { setSettleData({...settleData, amountType: 'full', amount: Math.abs(uBal)}); setIsSettleModalOpen(true); }}
                  className="bg-white text-gray-900 px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-90 transition-all"
                > Settle </button>
              </div>
            </div>
            <div className="flex gap-4 pt-3 border-t border-white/10">
               <div className="flex flex-col">
                  <span className="text-[7px] font-black uppercase opacity-50 tracking-tighter">Spent By User</span>
                  <span className="text-[11px] font-black">₹{uSpent.toLocaleString()}</span>
               </div>
               <div className="flex flex-col border-l border-white/10 pl-4">
                  <span className="text-[7px] font-black uppercase opacity-50 tracking-tighter">Paid By Admin</span>
                  <span className="text-[11px] font-black">₹{uRecv.toLocaleString()}</span>
               </div>
            </div>
          </div>

          {/* COMPACT HISTORY */}
          <div className="bg-white rounded-[1.8rem] border border-gray-100 overflow-hidden shadow-sm mb-20">
            <div className="p-3 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
              <span className="text-[9px] font-black uppercase opacity-40 tracking-widest italic ml-2">Recent Logs</span>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {uSet.length > 0 ? uSet.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-[10px]">💰</div>
                    <div>
                      <p className="text-[10px] font-black text-gray-800">{new Date(s.created_at).toLocaleDateString()}</p>
                      <p className="text-[8px] text-gray-400 font-bold uppercase truncate max-w-[120px]">{s.note || 'Cash/Online'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-emerald-600">₹{Number(s.amount)}</span>
                    {s.proof_url && (
                      <button onClick={() => setSelectedPreviewImage(s.proof_url)} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-[10px] shadow-sm active:bg-gray-900 active:text-white transition-all">🖼️</button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-10 text-center opacity-10 font-black text-xs italic tracking-widest">No Transactions</div>
              )}
            </div>
          </div>
        </div>
      );
    })()}

    {/* ⚖️ 4. SETTLEMENT MODAL (Modern & Compact) */}
   {/* ⚖️ 4. SETTLEMENT MODAL (Modern & Compact) */}
{isSettleModalOpen && (
  <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
      
      {/* Hum yahan balance ko dobara calculate kar rahe hain modal ke liye */}
      {(() => {
        const uExp = expenses.filter(e => e.user_id === selectedUser && e.status === 'approved');
        const uSet = settlements.filter(s => s.user_id === selectedUser);
        const currentBalance = uExp.reduce((s, e) => s + Number(e.amount), 0) - uSet.reduce((s, c) => s + Number(c.amount), 0);

        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-[0.2em]">
                {settleData.amountType === 'add_money' ? '➕ Adding Funds' : '⚖️ Settling Dues'}
              </h3>
              <button onClick={() => { setIsSettleModalOpen(false); setPreviewUrl(''); setTempFile(null); }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-black">×</button>
            </div>

            {settleData.amountType !== 'add_money' && (
              <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100">
                <button 
                  onClick={() => setSettleData({...settleData, amountType: 'full', amount: Math.abs(currentBalance)})} 
                  className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settleData.amountType === 'full' ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
                >
                  Pay Full
                </button>
                <button 
                  onClick={() => setSettleData({...settleData, amountType: 'fractional'})} 
                  className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settleData.amountType === 'fractional' ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
                >
                  Partial
                </button>
              </div>
            )}

            <input 
              type="number" 
              placeholder="0.00" 
              value={settleData.amount || ''} 
              readOnly={settleData.amountType === 'full'} 
              onChange={(e) => setSettleData({...settleData, amount: Number(e.target.value)})} 
              className="w-full p-4 bg-gray-50 rounded-2xl text-2xl font-black outline-none border-2 border-transparent focus:border-gray-100" 
            />
            
            <input 
              type="text" 
              placeholder="Note (e.g. UPI, Cash)" 
              value={settleData.note || ''} 
              onChange={(e) => setSettleData({...settleData, note: e.target.value})} 
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" 
            />

            {/* Proof Upload */}
            {!previewUrl ? (
              <label className="w-full h-28 rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all">
                <span className="text-xl">📸</span>
                <span className="text-[8px] font-black uppercase opacity-40 mt-1">Upload Receipt</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if(file) { setTempFile(file); setPreviewUrl(URL.createObjectURL(file)); }
                }} />
              </label>
            ) : (
              <div className="relative rounded-3xl overflow-hidden border-2 h-28 group">
                <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                <button onClick={() => {setPreviewUrl(''); setTempFile(null);}} className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full font-black text-[10px]">×</button>
              </div>
            )}

            <button 
              onClick={async () => {
                if(!tempFile) return toast.error("Please upload proof!");
                setIsLoading(true);
                const url = await uploadSettlementProof(tempFile);
                if(url) await handleFinalSettle(url);
                setIsLoading(false);
                setIsSettleModalOpen(false);
              }}
              disabled={!settleData.amount || !tempFile || isLoading}
              className="w-full py-5 bg-gray-900 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest disabled:opacity-20 shadow-xl active:scale-95 transition-all"
            >
              {isLoading ? "Processing..." : "Confirm & Save"}
            </button>
          </div>
        )
      })()}
    </div>
  </div>
)}

    {/* 🖼️ 5. IMAGE PREVIEW (Universal) */}
   {/* 🖼️ IMAGE PREVIEW (Using Imported Component) */}
    <ImagePreviewModal 
      imageUrl={selectedPreviewImage} 
      onClose={() => setSelectedPreviewImage(null)} 
    />
  </div>
)}
        {/* Users Tab - Same as your code */}
{tab === "users" && (
  <div className="space-y-2.5 pb-24 animate-in fade-in duration-500 px-3">
    {/* Google Style Compact Header */}
    <div className="flex items-center gap-2 mb-4 px-2 pt-2">
      <div className="flex gap-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FBBC05]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />
      </div>
      <h2 className="font-bold text-gray-500 text-[10px] uppercase tracking-[0.15em]">Directory Control</h2>
    </div>

    <div className="space-y-2">
      {users.map(u => {
        const userRoles = u.user_roles || [];
        const currentRole = userRoles.length > 0 ? userRoles[0].role : "user";
        const isAdmin = currentRole === "admin";
        const isTargetSuper = u.email === SUPER_ADMIN_EMAIL;
        const isApproved = u.is_approved; 
        const canManage = (role === 'admin' || user?.email === SUPER_ADMIN_EMAIL) && !isTargetSuper && u.id !== user?.id;

        // Google Dynamic Colors
        const themeColor = isTargetSuper ? "#4285F4" : isAdmin ? "#EA4335" : !isApproved ? "#FBBC05" : "#34A853";

        return (
          <div 
            key={u.id} 
            className="relative flex items-center gap-3 p-3 rounded-[1.8rem] bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all active:scale-[0.98]"
          >
            {/* 1. Google Avatar - Role Based */}
            <div 
              style={{ backgroundColor: themeColor }}
              className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm"
            >
              <span className="text-white font-black text-xs">
                {u.name?.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* 2. Info - Truncated for Safety */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-[12px] font-bold text-gray-800 truncate tracking-tight">
                  {u.name}
                </p>
                {!isApproved && <div className="w-1.5 h-1.5 bg-[#FBBC05] rounded-full animate-pulse" />}
              </div>
              <p className="text-[9px] font-medium text-gray-400 truncate tracking-wide uppercase">
                {isTargetSuper ? "Primary Owner" : isAdmin ? "System Admin" : "Active Staff"}
              </p>
            </div>

            {/* 3. Action Slot - Compact Google Buttons */}
            <div className="flex-shrink-0 ml-auto">
              {canManage ? (
                !isApproved ? (
                  <button
                    onClick={() => approveUser(u.id)}
                    className="px-4 py-2 bg-[#FBBC05] text-white rounded-full text-[9px] font-black uppercase tracking-tight shadow-md shadow-yellow-100 active:scale-90 transition-all"
                  >
                    Verify
                  </button>
                ) : (
                  /* Role Switcher - Material Look */
                  <div className="flex bg-gray-50 p-1 rounded-full border border-gray-100">
                    <button
                      onClick={() => toggleUserRole(u, 'admin')}
                      className={`px-3 py-1.5 rounded-full text-[8px] font-bold uppercase transition-all ${
                        isAdmin ? 'bg-white text-[#EA4335] shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      Admin
                    </button>
                    <button
                      onClick={() => toggleUserRole(u, 'user')}
                      className={`px-3 py-1.5 rounded-full text-[8px] font-bold uppercase transition-all ${
                        !isAdmin ? 'bg-white text-[#34A853] shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      Staff
                    </button>
                  </div>
                )
              ) : (
                <div 
                  style={{ color: themeColor, backgroundColor: `${themeColor}10` }}
                  className="px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-tighter border border-transparent"
                >
                  {isTargetSuper ? "Root" : isAdmin ? "Admin" : "User"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
        {/* Limits Tab - Same as your code */}
 
{tab === "limits" && (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
    {/* Header Section */}
    <div className="px-1 flex items-center justify-between">
      <div className="space-y-1">
        <h2 className="font-black text-gray-900 text-base tracking-tight flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Policy Controls
        </h2>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          Manage maximum daily disbursement limits
        </p>
      </div>
    </div>

    {/* Limits Grid */}
    <div className="grid gap-4">
      {limits.map((l) => {
        // Dynamic Icon & Color logic
        const getIcon = () => {
          switch(l.category) {
            case 'travel': return { icon: <Car className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50' };
            case 'meal': return { icon: <Utensils className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50' };
            case 'hotel': return { icon: <Hotel className="w-4 h-4" />, color: 'text-purple-600', bg: 'bg-purple-50' };
            default: return { icon: <Briefcase className="w-4 h-4" />, color: 'text-gray-600', bg: 'bg-gray-100' };
          }
        };
        const theme = getIcon();

        return (
          <div key={l.id} className="group relative bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Minimalist Icon Box */}
                <div className={`w-12 h-12 rounded-2xl ${theme.bg} ${theme.color} flex items-center justify-center transition-transform group-hover:scale-105`}>
                  {theme.icon}
                </div>
                
                <div>
                  <h3 className="text-xs font-black uppercase text-gray-800 tracking-wide">{l.category}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-bold text-gray-400 uppercase italic">Active Policy</span>
                  </div>
                </div>
              </div>

              {/* Minimalist Input Field */}
              <div className="flex flex-col items-end gap-1">
                <div className="relative group/input">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">₹</span>
                  <input
                    type="number"
                    disabled={isUpdating === l.id}
                    defaultValue={l.daily_limit}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val !== l.daily_limit) updateLimit(l.id, val || 0);
                    }}
                    className={`w-32 text-right pl-8 pr-5 py-3 text-sm font-black text-gray-900 bg-gray-50/50 border-none rounded-2xl outline-none transition-all focus:bg-white focus:ring-2 focus:ring-primary/10 ${
                      isUpdating === l.id ? "opacity-30 cursor-not-allowed" : "cursor-text"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Footer Info Card */}
    <div className="mt-8 p-5 bg-gray-900 rounded-[2.2rem] shadow-xl shadow-gray-200 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <ShieldCheck className="w-12 h-12 text-white" />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-1">Security Protocol</p>
        <p className="text-[11px] text-white font-medium leading-relaxed opacity-90">
          All changes are logged with <span className="text-emerald-400 font-black">Admin ID: {user?.id?.slice(0, 8)}</span>. 
          Limits are enforced in real-time across all mobile sessions.
        </p>
      </div>
    </div>
  </div>
)}
        {/* Reports Tab - Same as your code */}
 {tab === "reports" && (
  <div className="space-y-6 animate-fade-in pb-24 px-3 relative">
    
    {/* 📈 1. DYNAMIC ANALYTICS CARDS */}
    {(() => {
      // Filter expenses based on report filters
      const reportFiltered = expenses.filter(e => {
        const userName = e.profiles?.name || "Unknown User";
        const mName = e.missions?.name || "General";
        
        return (filters.category === 'all' || e.category === filters.category) &&
               (filters.status === 'all' || e.status === filters.status) &&
               (filters.userId === 'all' || userName === filters.userId) &&
               (filters.missionId === 'all' || mName === filters.missionId);
      });

      // Exclude cash from expense totals
      const totalExp = reportFiltered
        .filter(e => e.category !== 'cash')
        .reduce((s, e) => s + Number(e.amount), 0);
      const approvedExp = reportFiltered
        .filter(e => e.status === 'approved' && e.category !== 'cash')
        .reduce((s, e) => s + Number(e.amount), 0);
      const pendingExp = reportFiltered
        .filter(e => e.status === 'pending' && e.category !== 'cash')
        .reduce((s, e) => s + Number(e.amount), 0);

      // Settlement (received) amount - filtered by user if selected
      const filteredSettlements = settlements.filter(s => {
        if (filters.userId === 'all') return true;
        const settUser = users.find(u => u.id === s.user_id);
        return settUser?.name === filters.userId;
      });
      const totalReceived = filteredSettlements.reduce((s, c) => s + Number(c.amount), 0);
      const netBalance = totalReceived - approvedExp;

      return (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 opacity-80">Financial Summary</p>
                      <h2 className="text-4xl font-black italic tracking-tighter mt-1">₹{approvedExp.toLocaleString()}</h2>
                      <p className="text-[8px] font-bold text-white/40 uppercase mt-1">Approved Expenses (excl. Cash)</p>
                   </div>
                   <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                   </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-5">
                   <div>
                      <p className="text-[7px] font-black uppercase opacity-40 mb-1">Received</p>
                      <p className="text-[11px] font-bold text-emerald-400">₹{totalReceived.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[7px] font-black uppercase opacity-40 mb-1">Pending</p>
                      <p className="text-[11px] font-bold text-orange-400">₹{pendingExp.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[7px] font-black uppercase opacity-40 mb-1">Balance</p>
                      <p className={`text-[11px] font-bold ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>₹{netBalance.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[7px] font-black uppercase opacity-40 mb-1">Records</p>
                      <p className="text-[11px] font-bold">{reportFiltered.length}</p>
                   </div>
                </div>
             </div>
             <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10 flex items-end gap-1 px-4">
                {[40, 70, 45, 90, 65, 80, 30, 50, 85, 40].map((h, i) => (
                   <div key={i} className="flex-1 bg-white rounded-t-sm" style={{ height: `${h}%` }}></div>
                ))}
             </div>
          </div>
        </div>
      );
    })()}

    {/* 🛠️ 2. MULTI-DIMENSIONAL FILTERS */}
  <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
  {/* Header: Compact & Subtle */}
  <div className="flex items-center gap-2 px-1">
    <Filter className="w-3 h-3 text-gray-400" />
    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 italic">Filters</p>
  </div>

  <div className="grid grid-cols-2 gap-3">
    {/* 👤 Employee Filter */}
    <div className="group space-y-1">
      <label className="text-[8px] font-black uppercase text-gray-400 ml-1 group-focus-within:text-blue-500 transition-colors">
        Employee
      </label>
      <div className="relative">
        <select 
          value={filters.userId}
          onChange={(e) => setFilters({...filters, userId: e.target.value})}
          className="w-full bg-gray-50/50 border border-transparent p-2.5 rounded-xl text-[10px] font-black uppercase outline-none appearance-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/20"
        >
          <option value="all">All Users</option>
          {uniqueUsers.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none group-focus-within:text-blue-500" />
      </div>
    </div>

    {/* 🚀 Mission Filter */}
    <div className="group space-y-1">
      <label className="text-[8px] font-black uppercase text-gray-400 ml-1 group-focus-within:text-purple-500 transition-colors">
        Mission
      </label>
      <div className="relative">
        <select 
          value={filters.missionId} 
          onChange={(e) => setFilters({...filters, missionId: e.target.value})}
          className="w-full bg-gray-50/50 border border-transparent p-2.5 rounded-xl text-[10px] font-black uppercase outline-none appearance-none transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500/20"
        >
          <option value="all">All Missions</option>
          {uniqueMissionsReport.map(mName => <option key={mName} value={mName}>{mName}</option>)}
        </select>
        <Target className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none group-focus-within:text-purple-500" />
      </div>
    </div>

    {/* 📁 Category Filter */}
    <div className="group space-y-1">
      <label className="text-[8px] font-black uppercase text-gray-400 ml-1 group-focus-within:text-amber-500 transition-colors">
        Category
      </label>
      <div className="relative">
        <select 
          value={filters.category}
          onChange={(e) => setFilters({...filters, category: e.target.value})}
          className="w-full bg-gray-50/50 border border-transparent p-2.5 rounded-xl text-[10px] font-black uppercase outline-none appearance-none transition-all focus:bg-white focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500/20"
        >
          <option value="all">All Category</option>
          {["travel", "meal", "hotel", "luggage", "other"].map(cat => (
            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
          ))}
        </select>
        <LayoutGrid className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none group-focus-within:text-amber-500" />
      </div>
    </div>

    {/* ⚖️ Status Filter */}
    <div className="group space-y-1">
      <label className="text-[8px] font-black uppercase text-gray-400 ml-1 group-focus-within:text-emerald-500 transition-colors">
        Status
      </label>
      <div className="relative">
        <select 
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
          className="w-full bg-gray-50/50 border border-transparent p-2.5 rounded-xl text-[10px] font-black uppercase outline-none appearance-none transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/20"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <Activity className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none group-focus-within:text-emerald-500" />
      </div>
    </div>
  </div>
</div>

    {/* 🚀 3. EXPORT CENTER */}
    <div className="grid grid-cols-1 gap-3">
       <button 
         onClick={exportCSV}
         className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
       >
         <FileSpreadsheet className="w-5 h-5" /> Export Filtered Excel
       </button>
    </div>

    {/* 📋 4. DATA PREVIEW */}
    <div className="bg-white rounded-[2.2rem] border border-gray-100 shadow-sm overflow-hidden">
   <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Cost Distribution Preview</h4>
      <span className="text-[8px] font-black bg-gray-900 text-white px-2 py-1 rounded-md">LIVE VIEW</span>
   </div>
   <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-left">
         <tbody className="divide-y divide-gray-50">
            {/* ✅ Hum ab seedha 'filtered' variable use karenge jo humne useMemo mein banaya hai */}
            {filtered.slice(0, 20).map((e, i) => (
               <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                     {/* ✅ Profile Name correctly displayed */}
                     <p className="text-[10px] font-black text-gray-800 uppercase">
                        {e.profiles?.name || "Unknown"}
                     </p>
                     {/* ✅ Fix: Changed e.mission_name to e.missions?.name */}
                     <p className="text-[7px] text-gray-400 font-bold uppercase truncate max-w-[150px]">
                        {e.missions?.name || 'General'}
                     </p>
                  </td>
                  <td className="p-4 text-right">
                     <p className="text-[10px] font-black text-emerald-600 italic">
                        ₹{Number(e.amount).toLocaleString()}
                     </p>
                     <p className="text-[7px] font-black uppercase opacity-30">
                        {e.category} • {e.status}
                     </p>
                  </td>
               </tr>
            ))}
         </tbody>
      </table>
      
      {/* ✅ Check against filtered.length instead of raw expenses */}
      {filtered.length === 0 && (
         <div className="p-10 text-center opacity-20 font-black uppercase text-xs">
            No Records Found
         </div>
      )}
   </div>
</div>
  </div>
)}
      </div>
    </div>
  );
}
