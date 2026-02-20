import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Camera, Eye, CloudUpload, Loader2 } from "lucide-react";
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

function createSubRow(): SubRow {
  return { id: crypto.randomUUID(), description: "", amount: "", imageFile: null, imagePreview: null, uploadedUrl: null, uploading: false };
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
    { id: crypto.randomUUID(), category: "", subRows: [createSubRow()] },
  ]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const liveTotal = cards.reduce((total, card) => {
    const cardSum = card.subRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    return card.category === "cash" ? total - cardSum : total + cardSum;
  }, 0);

  const addCard = () => {
    setCards([...cards, { id: crypto.randomUUID(), category: "", subRows: [createSubRow()] }]);
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
    setCards(cards.map(c =>
      c.id === cardId
        ? { ...c, subRows: c.subRows.map(s => s.id === subId ? { ...s, [field]: value } : s) }
        : c
    ));
  };

  const handleImageSelect = (cardId: string, subId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateSubRow(cardId, subId, "imageFile", file);
      updateSubRow(cardId, subId, "imagePreview", e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (cardId: string, subId: string) => {
    const card = cards.find(c => c.id === cardId);
    const row = card?.subRows.find(s => s.id === subId);
    if (!row?.imageFile) return;

    updateSubRow(cardId, subId, "uploading", true);
    const fileName = `${userId}/${Date.now()}_${row.imageFile.name}`;
    const { data, error } = await supabase.storage
      .from("expense-receipts")
      .upload(fileName, row.imageFile);

    if (error) {
      toast.error("Upload failed");
      updateSubRow(cardId, subId, "uploading", false);
      return;
    }

    const { data: urlData } = supabase.storage.from("expense-receipts").getPublicUrl(data.path);
    updateSubRow(cardId, subId, "uploadedUrl", urlData.publicUrl);
    updateSubRow(cardId, subId, "uploading", false);
    toast.success("Image uploaded!");
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
    for (const card of cards) {
      if (!card.category) continue;
      for (const row of card.subRows) {
        if (!row.description && !row.amount) continue;
        allLogs.push({
          user_id: userId,
          mission_id: missionId,
          date,
          category: card.category,
          description: row.description,
          amount: parseFloat(row.amount) || 0,
          image_url: row.uploadedUrl || null,
          status: "pending",
        });
      }
    }

    if (allLogs.length === 0) {
      toast.error("Add at least one expense entry!");
      return;
    }

    // Check limits
    for (const log of allLogs) {
      if (!checkLimits(log.category, log.amount)) {
        toast.warning(`${log.category} exceeds daily limit — requires admin approval`);
      }
    }

    setSaving(true);
    const { error } = await supabase.from("expenses").insert(allLogs);
    if (error) {
      toast.error("Save failed: " + error.message);
    } else {
      toast.success("Expenses saved!");
      setCards([{ id: crypto.randomUUID(), category: "", subRows: [createSubRow()] }]);
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="mt-6 glass-card rounded-4xl p-5 animate-fade-in">
      <div className="flex justify-between items-start mb-5">
        <h3 className="text-lg font-black text-foreground italic">Daily Entry</h3>
        <div className="text-right">
          <span className={`text-xs font-black px-3 py-1 rounded-full ${liveTotal < 0 ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
            ₹ {liveTotal.toLocaleString()}
          </span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="block mt-2 text-[10px] font-bold text-muted-foreground bg-secondary p-1.5 rounded-lg outline-none border border-border"
          />
        </div>
      </div>

      <div className="space-y-4">
        {cards.map((card) => (
          <div key={card.id} className="bg-card p-3 rounded-2xl border border-border relative animate-fade-in shadow-sm">
            {/* Category Tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => selectCategory(card.id, cat)}
                  className={`text-[7px] font-black uppercase rounded-lg border w-[52px] h-6 flex items-center justify-center transition-all active:scale-90 ${
                    card.category === cat
                      ? CATEGORY_COLORS[cat]
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sub Rows */}
            <div className="space-y-2 mt-2">
              {card.subRows.map((row, idx) => (
                <div
                  key={row.id}
                  className={`${SUB_ROW_COLORS[idx % SUB_ROW_COLORS.length]} p-3 rounded-2xl border border-border/50 animate-fade-in`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-3 bg-primary rounded-full" />
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                        {card.category ? `${card.category} ${idx + 1}` : `Expense ${idx + 1}`}
                      </span>
                    </div>
                    {card.subRows.length > 1 && (
                      <button onClick={() => removeSubRow(card.id, row.id)} className="w-6 h-6 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="bg-card/80 backdrop-blur-sm p-3 rounded-xl border border-card shadow-inner mb-2">
                    <div className="flex items-center gap-3">
                      <textarea
                        placeholder="Detail (Stop, Tea, Bill etc.)"
                        rows={1}
                        value={row.description}
                        onChange={e => { updateSubRow(card.id, row.id, "description", e.target.value); e.target.style.height = ""; e.target.style.height = e.target.scrollHeight + "px"; }}
                        className="flex-grow w-full text-[11px] border-none outline-none bg-transparent font-bold text-foreground h-6 leading-tight resize-none overflow-hidden placeholder:text-muted-foreground/50"
                      />
                      <div className="w-24 flex-shrink-0 flex items-center bg-primary/5 px-2 py-1.5 rounded-lg border border-primary/20">
                        <span className="text-[10px] font-black text-primary/60 mr-1">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={row.amount}
                          onChange={e => updateSubRow(card.id, row.id, "amount", e.target.value)}
                          className="w-full bg-transparent font-black text-[12px] outline-none text-right text-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Image Actions */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex gap-1.5 items-center">
                      <label className="w-7 h-7 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors relative overflow-hidden shadow-sm">
                        {row.imagePreview ? (
                          <img src={row.imagePreview} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-3 h-3 text-muted-foreground" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => e.target.files?.[0] && handleImageSelect(card.id, row.id, e.target.files[0])}
                        />
                      </label>
                      {row.imagePreview && (
                        <button
                          onClick={() => setPreviewImage(row.imagePreview)}
                          className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                      {row.imagePreview && !row.uploadedUrl && (
                        <button
                          onClick={() => uploadImage(card.id, row.id)}
                          disabled={row.uploading}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-all ${
                            row.uploading ? "bg-warning text-warning-foreground" : "bg-blue-400 text-primary-foreground"
                          }`}
                        >
                          {row.uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
                        </button>
                      )}
                      {row.uploadedUrl && (
                        <div className="w-7 h-7 rounded-lg bg-success text-success-foreground flex items-center justify-center">✓</div>
                      )}
                    </div>
                    <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-tighter italic">Verify Receipt</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => addSubRow(card.id)}
              className="w-full py-1.5 border border-dashed border-border rounded-lg text-primary text-[8px] font-black uppercase tracking-wider mt-2 hover:bg-primary/5 transition-all"
            >
              + Add More Details
            </button>

            <div className="flex justify-end pt-1 border-t border-border/50 mt-2">
              <button onClick={() => removeCard(card.id)} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addCard} className="w-full mt-4 py-3 border-2 border-dashed border-primary/30 rounded-2xl text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all">
        + Add Item
      </button>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-4 bg-primary text-primary-foreground py-4 rounded-2xl font-black shadow-xl uppercase text-[10px] tracking-widest active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Sync"}
      </button>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
