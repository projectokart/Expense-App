import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, X } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

interface Props {
  missionId: string;
  userId: string;
  isActive: boolean;
}

export default function MissionGallery({ missionId, userId, isActive }: Props) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotos();
  }, [missionId]);

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from("mission_photos" as any)
      .select("*")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: false });
    setPhotos(data || []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 15 - photos.length;
    if (files.length > remaining) {
      toast.error(`You can upload ${remaining} more photos (max 15)`);
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${missionId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('mission-photos')
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Failed to upload: " + file.name);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('mission-photos')
          .getPublicUrl(fileName);

        await supabase.from("mission_photos" as any).insert({
          mission_id: missionId,
          user_id: userId,
          image_url: urlData.publicUrl,
        });
      }
      toast.success("Photos uploaded!");
      fetchPhotos();
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deletePhoto = async (photo: any) => {
    if (!confirm("Delete this photo?")) return;
    setDeletingId(photo.id);
    try {
      // Extract path from URL
      const urlParts = photo.image_url.split('/mission-photos/');
      if (urlParts[1]) {
        await supabase.storage.from('mission-photos').remove([urlParts[1]]);
      }
      await supabase.from("mission_photos" as any).delete().eq("id", photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      toast.success("Photo deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeletingId(null);
  };

  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
          Gallery ({photos.length}/15)
        </span>
        {isActive && photos.length < 15 && (
          <label className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-lg cursor-pointer hover:bg-primary/20 transition-all active:scale-95">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            <span className="text-[8px] font-black uppercase">Add Photos</span>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map(photo => (
            <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
              <img
                src={photo.image_url}
                className="w-full h-full object-cover cursor-pointer"
                alt=""
                onClick={() => setPreviewImage(photo.image_url)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
              {isActive && photo.user_id === userId && (
                <button
                  onClick={() => deletePhoto(photo)}
                  disabled={deletingId === photo.id}
                  className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  {deletingId === photo.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 bg-secondary/30 rounded-xl border border-dashed border-border">
          <Camera className="w-5 h-5 text-muted-foreground/20 mx-auto mb-1" />
          <p className="text-[8px] text-muted-foreground/40 font-bold uppercase">No photos yet</p>
        </div>
      )}

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
