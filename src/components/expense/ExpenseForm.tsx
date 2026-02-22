import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Camera, Eye, CloudUpload, Loader2,Check,Send } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

interface SubRow {
  id: string;
  description: string;
  amount: string;
  imageFile: File | null;
  imagePreview: string | null;
  uploadedUrl: string | null;
  uploading: boolean;
}

interface ExpenseCard {
  id: string;
  category: string;
  subRows: SubRow[];
}

const CATEGORIES = ["travel", "meal", "luggage", "hotel", "cash", "other"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  travel: "bg-category-travel text-primary-foreground",
  meal: "bg-category-meal text-primary-foreground",
  hotel: "bg-category-hotel text-primary-foreground",
  luggage: "bg-category-luggage text-primary-foreground",
  cash: "bg-category-cash text-primary-foreground",
  other: "bg-category-other text-primary-foreground",
};

const SUB_ROW_COLORS = [
  "bg-blue-50/90", "bg-green-50/90", "bg-amber-50/90", "bg-red-50/90", "bg-purple-50/90",
];

// FIXED: Universal ID Generator to prevent crashes
function generateSafeId() {
  return Math.random().toString(36).substring(2, 11);
}

function createSubRow(): SubRow {
  return { id: generateSafeId(), description: "", amount: "", imageFile: null, imagePreview: null, uploadedUrl: null, uploading: false };
}

export default function ExpenseForm({
  userId,
  missionId,
  categoryLimits,
  todayExpenses,
  onSaved,
}: {
  userId: string;
  missionId: string;
  categoryLimits: Record<string, number>;
  todayExpenses: any[];
  onSaved: () => void;
}) {
  const [cards, setCards] = useState<ExpenseCard[]>([
    { id: generateSafeId(), category: "", subRows: [createSubRow()] },
  ]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const liveTotal = cards.reduce((total, card) => {
    const cardSum = card.subRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    return card.category === "cash" ? total - cardSum : total + cardSum;
  }, 0);

  // Per-category usage: today's existing + current form entries
  const getCategoryUsage = (category: string) => {
    const existingTotal = todayExpenses
      .filter(e => e.category === category)
      .reduce((s, e) => s + Number(e.amount), 0);
    const currentTotal = cards
      .filter(c => c.category === category)
      .reduce((s, c) => s + c.subRows.reduce((ss, r) => ss + (parseFloat(r.amount) || 0), 0), 0);
    return { existingTotal, currentTotal, total: existingTotal + currentTotal };
  };

  const getCategoryLimitStatus = (category: string) => {
    const limit = categoryLimits[category];
    if (!limit || limit === 0) return null; // No limit set
    const { total } = getCategoryUsage(category);
    const remaining = limit - total;
    const exceeded = remaining < 0;
    const pct = Math.min((total / limit) * 100, 100);
    return { limit, total, remaining, exceeded, pct };
  };

  const addCard = () => {
    setCards([...cards, { id: generateSafeId(), category: "", subRows: [createSubRow()] }]);
  };

  const removeCard = (cardId: string) => {
    setCards(cards.filter(c => c.id !== cardId));
  };

  const selectCategory = (cardId: string, cat: string) => {
    setCards(cards.map(c => c.id === cardId ? { ...c, category: cat } : c));
  };

  const addSubRow = (cardId: string) => {
    setCards(cards.map(c => c.id === cardId ? { ...c, subRows: [...c.subRows, createSubRow()] } : c));
  };

  const removeSubRow = (cardId: string, subId: string) => {
    setCards(cards.map(c => c.id === cardId ? { ...c, subRows: c.subRows.filter(s => s.id !== subId) } : c));
  };

  const updateSubRow = (cardId: string, subId: string, field: string, value: any) => {
  setCards(prevCards => prevCards.map(card => {
    if (card.id === cardId) {
      return {
        ...card,
        subRows: card.subRows.map(row => 
          // YAHAN Galti hoti hai: row ko copy karna zaroori hai (...row)
          row.id === subId ? { ...row, [field]: value } : row 
        )
      };
    }
    return card;
  }));
};

const handleImageSelect = async (cardId: string, subId: string, file: File) => {
  if (!file) return;

  // 1. Local Preview URL create karein (FileReader se fast hai ye)
  const previewUrl = URL.createObjectURL(file);
  
  // 2. State update karein (Taaki image TURANT dikhe)
  updateSubRow(cardId, subId, "imagePreview", previewUrl);
  updateSubRow(cardId, subId, "uploading", true);

  try {
    const card = cards.find(c => c.id === cardId);
    const row = card?.subRows.find(s => s.id === subId);

    // Purani image delete logic (agar pehle se upload thi)
    if (row?.uploadedUrl) {
      const oldFileName = row.uploadedUrl.split('/').pop();
      if (oldFileName) {
        await supabase.storage.from("expense-receipts").remove([`${userId}/${oldFileName}`]);
      }
    }

    // Nayi image upload karein
    const fileName = `${userId}/${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error: uploadError } = await supabase.storage
      .from("expense-receipts")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("expense-receipts").getPublicUrl(data.path);

    // 3. Server URL state mein save karein
    updateSubRow(cardId, subId, "uploadedUrl", urlData.publicUrl);
    
  } catch (error: any) {
    console.error("Upload failed:", error);
    toast.error("Upload failed, but preview is shown locally.");
  } finally {
    updateSubRow(cardId, subId, "uploading", false);
  }
};
const uploadImage = async (cardId: string, subId: string) => {
  const card = cards.find(c => c.id === cardId);
  const row = card?.subRows.find(s => s.id === subId);
  
  if (!row?.imageFile) return;

  updateSubRow(cardId, subId, "uploading", true);

  try {
    // 1. PURANI IMAGE DELETE KARNA (Agar 'uploadedUrl' pehle se maujood hai)
    if (row.uploadedUrl) {
      try {
        // URL se filename nikalne ka logic
        const oldPath = row.uploadedUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from("expense-receipts")
            .remove([`${userId}/${oldPath}`]);
          console.log("Old file deleted successfully");
        }
      } catch (delError) {
        console.error("Old file deletion failed:", delError);
        // Error aane par bhi hum upload continue rakhenge
      }
    }

    // 2. NAYI IMAGE UPLOAD KARNA
    const fileExt = row.imageFile.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`; // Timestamp based unique name

    const { data, error: uploadError } = await supabase.storage
      .from("expense-receipts")
      .upload(fileName, row.imageFile);

    if (uploadError) throw uploadError;

    // 3. PUBLIC URL LENA
    const { data: urlData } = supabase.storage
      .from("expense-receipts")
      .getPublicUrl(data.path);

    // 4. STATE UPDATE
    updateSubRow(cardId, subId, "uploadedUrl", urlData.publicUrl);
    updateSubRow(cardId, subId, "uploading", false);
    toast.success("Image updated & old one deleted!");

  } catch (error: any) {
    console.error("Upload error:", error);
    toast.error(error.message || "Upload failed");
    updateSubRow(cardId, subId, "uploading", false);
  }
};
  const checkLimits = (category: string, amount: number): boolean => {
    const limit = categoryLimits[category];
    if (!limit || limit === 0) return true;

    const existingTotal = todayExpenses
      .filter(e => e.category === category)
      .reduce((s, e) => s + Number(e.amount), 0);

    const currentCardsTotal = cards
      .filter(c => c.category === category)
      .reduce((s, c) => s + c.subRows.reduce((ss, r) => ss + (parseFloat(r.amount) || 0), 0), 0);

    return (existingTotal + currentCardsTotal) <= limit;
  };

  const handleSave = async () => {
  const allLogs: any[] = [];
  
  // 1. Data Structure Prepare karein
  for (const card of cards) {
    if (!card.category) continue;
    
    for (const row of card.subRows) {
      // Sirf wahi rows uthao jinme description ya amount ho
      if (!row.description && !row.amount) continue;

      const amountValue = parseFloat(row.amount) || 0;

      allLogs.push({
        user_id: userId,
        mission_id: missionId,
        date: date, // Make sure 'date' state sahi format mein ho (YYYY-MM-DD)
        category: card.category,
        description: row.description,
        amount: amountValue,
        image_url: row.uploadedUrl || null, // Auto-uploaded URL yahan se jayega
        status: "pending",
      });
    }
  }

  // 2. Validation
  if (allLogs.length === 0) {
    toast.error("Add at least one expense entry!");
    return;
  }

  // 3. Limit Checks - Block if any category exceeds limit
  const exceededCategories: string[] = [];
  for (const log of allLogs) {
    const status = getCategoryLimitStatus(log.category);
    if (status?.exceeded) {
      exceededCategories.push(log.category);
    }
  }

  if (exceededCategories.length > 0) {
    const uniqueCats = [...new Set(exceededCategories)];
    toast.error(`Daily limit exceeded for: ${uniqueCats.join(", ").toUpperCase()}. Reduce amounts or contact admin.`);
    return;
  }

  // 4. Final Database Insert
  setSaving(true);
  try {
    const { error } = await supabase.from("expenses").insert(allLogs);
    
    if (error) throw error;

    toast.success("All expenses saved to cloud!");
    
    // UI Reset: Form ko wapas initial state mein lana
    setCards([{ 
      id: generateSafeId(), 
      category: "", 
      subRows: [createSubRow()] 
    }]);
    
    if (onSaved) onSaved(); // Callback to refresh the parent list

  } catch (error: any) {
    console.error("Save Error:", error);
    toast.error("Save failed: " + error.message);
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="mt-6 glass-card rounded-4xl p-5 animate-fade-in shadow-2xl border border-white/20">
      <div className="flex justify-between items-start mb-5">
        <h3 className="text-lg font-black text-foreground italic tracking-tight">Daily Entry</h3>
        <div className="text-right">
          <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl shadow-inner ${liveTotal < 0 ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
            ₹ {liveTotal.toLocaleString()}
          </span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="block mt-2 text-[10px] font-bold text-muted-foreground bg-secondary/50 p-1.5 rounded-lg outline-none border border-border"
          />
        </div>
      </div>

      <div className="space-y-4">
        {cards.map((card) => (
          <div key={card.id} className="bg-card/50 backdrop-blur-sm p-3 rounded-3xl border border-border relative animate-fade-in shadow-sm">
            
            {/* CATEGORY BUTTONS - Now Auto-Fitting in One Line */}
            <div className="flex flex-row gap-1 mb-3 w-full overflow-hidden">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => selectCategory(card.id, cat)}
                  className={`flex-1 min-w-0 h-7 text-[7px] font-black uppercase rounded-lg border transition-all active:scale-95 truncate ${
                    card.category === cat
                      ? CATEGORY_COLORS[cat]
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Category Limit Warning */}
            {card.category && (() => {
              const status = getCategoryLimitStatus(card.category);
              if (!status) return null;
              return (
                <div className={`mb-2 px-3 py-2 rounded-xl border text-[9px] font-bold ${
                  status.exceeded 
                    ? "bg-destructive/10 border-destructive/30 text-destructive" 
                    : status.pct >= 80 
                      ? "bg-warning/10 border-warning/30 text-warning" 
                      : "bg-success/10 border-success/30 text-success"
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="uppercase font-black tracking-wider">
                      {status.exceeded ? "⚠ Limit Exceeded" : status.pct >= 80 ? "⚠ Near Limit" : "✓ Within Limit"}
                    </span>
                    <span>₹{status.total.toLocaleString()} / ₹{status.limit.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        status.exceeded ? "bg-destructive" : status.pct >= 80 ? "bg-warning" : "bg-success"
                      }`}
                      style={{ width: `${Math.min(status.pct, 100)}%` }}
                    />
                  </div>
                  {status.exceeded && (
                    <p className="mt-1 text-[8px] italic">Reduce amount to submit. Current overage: ₹{Math.abs(status.remaining).toLocaleString()}</p>
                  )}
                </div>
              );
            })()}

            {/* Sub Rows */}
            <div className="space-y-2 mt-2">
  {card.subRows.map((row, idx) => (
    <div
      key={row.id}
      className={`${SUB_ROW_COLORS[idx % SUB_ROW_COLORS.length]} p-3 rounded-2xl border border-border/30 animate-fade-in shadow-sm`}
    >
      {/* Header Row */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-primary/40 rounded-full" />
          <span className="text-[9px] font-black text-muted-foreground/70 uppercase tracking-widest">
            {card.category ? `${card.category} #${idx + 1}` : `Expense #${idx + 1}`}
          </span>
        </div>
        {card.subRows.length > 1 && (
          <button onClick={() => removeSubRow(card.id, row.id)} className="w-6 h-6 flex items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-75 transition-all">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Input Section */}
      <div className="bg-white/60 backdrop-blur-md p-3 rounded-xl border border-white shadow-inner mb-2 flex items-center gap-2">
        <textarea
          placeholder="Detail (e.g. Lunch at Highway)"
          rows={1}
          value={row.description}
          onChange={e => { updateSubRow(card.id, row.id, "description", e.target.value); e.target.style.height = ""; e.target.style.height = e.target.scrollHeight + "px"; }}
          className="flex-grow bg-transparent text-[11px] font-bold text-foreground outline-none resize-none leading-tight"
        />
        <div className="w-20 flex-shrink-0 flex items-center bg-white rounded-lg border border-primary/10 px-2 py-1">
          <span className="text-[10px] font-black text-primary/40 mr-1">₹</span>
          <input
            type="number"
            placeholder="0"
            value={row.amount}
            onChange={e => updateSubRow(card.id, row.id, "amount", e.target.value)}
            className="w-full bg-transparent font-black text-[12px] text-right text-primary outline-none"
          />
        </div>
      </div>

      {/* Image Actions (Auto-Upload Version) */}
      <div className="flex items-center justify-between px-1 mt-3">
        <div className="flex gap-2 items-center">
          {/* Main Camera/Preview Button */}
          <label className={`w-8 h-8 border rounded-xl flex items-center justify-center cursor-pointer active:scale-90 transition-all relative overflow-hidden shadow-sm ${row.uploading ? 'bg-secondary' : 'bg-white'}`}>
            {row.imagePreview ? (
              <img src={row.imagePreview} className={`absolute inset-0 w-full h-full object-cover ${row.uploading ? 'opacity-40' : 'opacity-100'}`} />
            ) : (
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            
            {/* Uploading Spinner Overlay */}
            {row.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              </div>
            )}
            
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={row.uploading}
              onChange={e => e.target.files?.[0] && handleImageSelect(card.id, row.id, e.target.files[0])}
            />
          </label>

          {/* Action Buttons */}
          {row.imagePreview && !row.uploading && (
            <div className="flex gap-1.5 animate-in fade-in zoom-in duration-200">
              {/* Full Preview Button */}
              <button onClick={() => setPreviewImage(row.imagePreview)} className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-90">
                <Eye className="w-3.5 h-3.5" />
              </button>

              {/* Upload Success Indicator */}
              {row.uploadedUrl && (
                <div className="w-8 h-8 rounded-xl bg-success/20 text-success flex items-center justify-center border border-success/30">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Tag */}
        <div className="flex flex-col items-end">
          <span className="text-[7px] font-black text-muted-foreground/30 uppercase italic">Digital Receipt</span>
          {row.uploading && <span className="text-[6px] font-bold text-primary animate-pulse uppercase">Uploading...</span>}
        </div>
      </div>
    </div>
  ))}
</div>
            <button onClick={() => addSubRow(card.id)} className="w-full mt-3 py-2 border border-dashed border-primary/20 rounded-xl text-primary text-[8px] font-black uppercase hover:bg-primary/5 transition-all active:scale-95">
              + New Sub-Item
            </button>

            <div className="flex justify-end pt-2 border-t border-border/30 mt-3">
              <button onClick={() => removeCard(card.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addCard} className="w-full mt-5 py-4 border-2 border-dashed border-primary/20 rounded-[2rem] text-primary text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
        + Add Category Card
      </button>

      <button
  onClick={handleSave}
  disabled={saving}
  className="w-full mt-6 bg-primary text-primary-foreground py-3.5 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
>
  {saving ? (
    <>
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>Processing...</span>
    </>
  ) : (
    <>
      <Send className="w-3.5 h-3.5" />
      <span>Submit Entry</span>
    </>
  )}
</button>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
