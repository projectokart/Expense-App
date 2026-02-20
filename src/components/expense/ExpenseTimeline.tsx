import { ChevronDown } from "lucide-react";
import { useState } from "react";

const CATEGORY_DOT_COLORS: Record<string, string> = {
  travel: "bg-category-travel",
  meal: "bg-category-meal",
  hotel: "bg-category-hotel",
  luggage: "bg-category-luggage",
  cash: "bg-category-cash",
  other: "bg-category-other",
};

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-status-pending/20 text-status-pending",
  approved: "bg-status-approved/20 text-status-approved",
  rejected: "bg-status-rejected/20 text-status-rejected",
  settled: "bg-status-settled/20 text-status-settled",
};

interface Props {
  expenses: any[];
}

export default function ExpenseTimeline({ expenses }: Props) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  if (expenses.length === 0) {
    return (
      <div className="mt-8 text-center py-10">
        <p className="text-muted-foreground text-xs italic">No records found...</p>
      </div>
    );
  }

  const grouped = expenses.reduce<Record<string, any[]>>((acc, exp) => {
    const d = exp.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(exp);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const toggleDate = (d: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-3 px-2">
        <h3 className="font-black text-foreground uppercase text-[10px] tracking-widest">Journey Logbook</h3>
        <span className="text-[9px] bg-secondary px-2 py-0.5 rounded-full font-bold text-muted-foreground">
          {expenses.length} Logs
        </span>
      </div>

      <div className="space-y-3">
        {sortedDates.map(date => {
          const items = grouped[date];
          const dayTotal = items.reduce((s, e) => e.category === "cash" ? s - Number(e.amount) : s + Number(e.amount), 0);
          const isOpen = expandedDates.has(date);

          return (
            <div key={date} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden animate-fade-in">
              <button
                onClick={() => toggleDate(date)}
                className="w-full p-4 flex justify-between items-center bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="text-left">
                  <span className="text-[9px] font-black text-primary uppercase tracking-tighter">{date}</span>
                  <p className="text-[10px] font-black text-foreground">{items.length} Entries</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-black ${dayTotal < 0 ? "text-success" : "text-destructive"}`}>
                    ₹{Math.abs(dayTotal).toLocaleString()}
                  </p>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {isOpen && (
                <div className="p-3 divide-y divide-border">
                  {items.map((item: any) => (
                    <div key={item.id} className="py-2 flex justify-between items-center text-[10px] font-bold">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${CATEGORY_DOT_COLORS[item.category] || "bg-muted-foreground"}`} />
                        <span className="text-muted-foreground uppercase">{item.category}</span>
                        <span className="text-foreground">{item.description}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${STATUS_BADGES[item.status] || ""}`}>
                          {item.status}
                        </span>
                      </div>
                      <span className={item.category === "cash" ? "text-success" : "text-destructive"}>
                        {item.category === "cash" ? "+" : "-"} ₹{Number(item.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
