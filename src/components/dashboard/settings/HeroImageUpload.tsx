import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";

interface HeroImageUploadProps {
  businessId: string;
  currentHeroUrl: string | null;
  onUpdate: () => void;
}

export const HeroImageUpload = ({ businessId, currentHeroUrl, onUpdate }: HeroImageUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${businessId}-hero.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("business-hero")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("business-hero").getPublicUrl(filePath);
      // Cache-bust so updates show immediately
      const cacheBusted = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("businesses")
        .update({ hero_image_url: cacheBusted })
        .eq("id", businessId);
      if (updateError) throw updateError;

      toast({ title: "Cover photo uploaded", description: "Your cover photo has been updated." });
      onUpdate();
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!currentHeroUrl) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ hero_image_url: null })
        .eq("id", businessId);
      if (error) throw error;
      toast({ title: "Cover photo removed" });
      onUpdate();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message || "Failed to remove image", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Cover Photo</Label>
      {currentHeroUrl ? (
        <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
          <img src={currentHeroUrl} alt="Cover" className="w-full h-40 object-cover" />
        </div>
      ) : (
        <div className="w-full h-40 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>) : (<><Upload className="h-4 w-4 mr-2" />{currentHeroUrl ? "Change Cover" : "Upload Cover"}</>)}
        </Button>
        {currentHeroUrl && (
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} className="text-destructive hover:text-destructive">
            {deleting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Removing...</>) : (<><Trash2 className="h-4 w-4 mr-2" />Remove</>)}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Recommended 1200 × 400 px. Max 5MB.</p>
    </div>
  );
};
