import { X } from "lucide-react";

interface Props {
  imageUrl: string | null;
  onClose: () => void;
}

export default function ImagePreviewModal({ imageUrl, onClose }: Props) {
  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-foreground/60 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="bg-card/98 backdrop-blur-xl border border-border shadow-2xl w-[92%] max-w-[380px] rounded-4xl p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Image Preview</span>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="w-full h-72 bg-secondary rounded-3xl overflow-hidden mb-4">
          <img src={imageUrl} className="w-full h-full object-contain" alt="Preview" />
        </div>
      </div>
    </div>
  );
}
