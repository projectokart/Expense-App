interface Props {
  totalReceived: number;
  totalExpense: number;
  todayExpense: number;
  todayReceived: number;
}

export default function ExpenseSummaryCard({ totalReceived, totalExpense, todayExpense, todayReceived }: Props) {
  const balance = totalReceived - totalExpense;
  const statusMsg = balance > 0 ? "Advance Available" : balance < 0 ? "Due Pending" : "Balanced";

  return (
    <div className="space-y-2">
      {/* Main Summary */}
      <div className="bg-card rounded-2xl shadow-md border border-border p-3 pb-2 ring-1 ring-border/50">
        <div className="flex justify-between items-center px-1 mb-1">
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[7px] text-muted-foreground font-black uppercase tracking-tighter">Received</span>
              <span className="text-base font-black text-success leading-none tracking-tighter">₹ {totalReceived.toLocaleString()}</span>
            </div>
            <div className="flex flex-col border-l border-border pl-4">
              <span className="text-[7px] text-muted-foreground font-black uppercase tracking-tighter">Expense</span>
              <span className="text-base font-black text-destructive leading-none tracking-tighter">₹ {totalExpense.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary text-[7px] font-black uppercase tracking-tighter leading-none mb-0.5">Net Balance</p>
            <h3 className={`text-2xl font-black tracking-tighter italic leading-none ${balance < 0 ? "text-destructive" : "text-foreground"}`}>
              ₹ {balance.toLocaleString()}
            </h3>
          </div>
        </div>
        <div className="mt-2 pt-1.5 border-t border-border/50 flex justify-end">
          <p className={`text-[9px] font-bold italic uppercase tracking-tighter ${
            balance > 0 ? "text-success" : balance < 0 ? "text-destructive animate-pulse" : "text-muted-foreground"
          }`}>
            {statusMsg}
          </p>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="bg-foreground rounded-2xl p-2.5 px-4 shadow-lg flex justify-between items-center">
        <div className="flex gap-5">
          <div className="flex flex-col">
            <p className="text-muted-foreground text-[6px] uppercase font-black mb-0.5">Today's Exp</p>
            <p className="text-[13px] font-black text-background italic leading-none">₹ {todayExpense.toLocaleString()}</p>
          </div>
          <div className="flex flex-col">
            <p className="text-muted-foreground text-[6px] uppercase font-black mb-0.5">Today's Rec</p>
            <p className="text-[13px] font-black text-success italic leading-none">₹ {todayReceived.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
