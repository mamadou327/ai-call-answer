import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2, Image as ImageIcon } from "lucide-react";

interface LogoUploadProps {
  businessId: string;
  currentLogoUrl: string | null;
  onUpdate: () => void;
}

export const LogoUpload = ({ businessId, currentLogoUrl, onUpdate }: LogoUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create file path — must start with business_id to match storage RLS policy
      const fileExt = file.name.split(".").pop();
      const filePath = `${businessId}/logo.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("business-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("business-logos")
        .getPublicUrl(filePath);

      // Update business record
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ logo_url: publicUrl })
        .eq("id", businessId);

      if (updateError) throw updateError;

      toast({
        title: "Logo uploaded",
        description: "Your business logo has been updated.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!currentLogoUrl) return;

    setDeleting(true);
    try {
      // Update business record to remove logo URL
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ logo_url: null })
        .eq("id", businessId);

      if (updateError) throw updateError;

      toast({
        title: "Logo removed",
        description: "Your business logo has been removed.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to remove logo",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Business Logo</Label>
      <div className="flex items-start gap-4">
        {currentLogoUrl ? (
          <div className="relative">
            <img
              src={currentLogoUrl}
              alt="Business logo"
              className="w-24 h-24 object-contain rounded-lg border bg-muted"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {currentLogoUrl ? "Change Logo" : "Upload Logo"}
              </>
            )}
          </Button>
          {currentLogoUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </>
              )}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            JPG, PNG, or WebP. Max 2MB.
          </p>
        </div>
      </div>
    </div>
  );
};
