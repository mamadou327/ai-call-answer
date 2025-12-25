import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2, Image as ImageIcon, GripVertical } from "lucide-react";

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  staff_id: string | null;
  display_order: number;
}

interface Staff {
  id: string;
  name: string;
}

interface GalleryManagementProps {
  businessId: string;
  onUpdate: () => void;
}

export const GalleryManagement = ({ businessId, onUpdate }: GalleryManagementProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    loadGallery();
    loadStaff();
  }, [businessId]);

  const loadGallery = async () => {
    const { data } = await supabase
      .from("business_gallery")
      .select("*")
      .eq("business_id", businessId)
      .order("display_order", { ascending: true });

    if (data) setImages(data);
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", businessId);

    if (data) setStaff(data);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const file of Array.from(files)) {
        // Validate file type
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not a valid image. Skipping.`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} is larger than 5MB. Skipping.`,
            variant: "destructive",
          });
          continue;
        }

        // Create unique file path
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("business-gallery")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("business-gallery")
          .getPublicUrl(filePath);

        // Add to gallery table
        const { error: insertError } = await supabase
          .from("business_gallery")
          .insert({
            business_id: businessId,
            image_url: publicUrl,
            display_order: images.length,
          });

        if (insertError) {
          console.error("Insert error:", insertError);
        }
      }

      toast({
        title: "Upload complete",
        description: "Images have been added to your gallery.",
      });
      loadGallery();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload images",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (image: GalleryImage) => {
    setDeletingId(image.id);
    try {
      const { error } = await supabase
        .from("business_gallery")
        .delete()
        .eq("id", image.id);

      if (error) throw error;

      toast({
        title: "Image deleted",
        description: "The image has been removed from your gallery.",
      });
      loadGallery();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete image",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateImage = async (image: GalleryImage, updates: Partial<GalleryImage>) => {
    try {
      const { error } = await supabase
        .from("business_gallery")
        .update(updates)
        .eq("id", image.id);

      if (error) throw error;

      loadGallery();
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update image",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Gallery</Label>
          <p className="text-sm text-muted-foreground">
            Upload photos to showcase your work on your booking page.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="outline"
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
                Add Photos
              </>
            )}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">No photos yet</p>
          <p className="text-sm text-muted-foreground">Upload photos to showcase your work</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <img
                src={image.image_url}
                alt={image.caption || "Gallery image"}
                className="w-full h-32 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setEditingImage(image)}
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(image)}
                  disabled={deletingId === image.id}
                >
                  {deletingId === image.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {image.staff_id && (
                <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {staff.find((s) => s.id === image.staff_id)?.name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Image Dialog */}
      {editingImage && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold">Edit Image</h3>
            <img
              src={editingImage.image_url}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            <div className="space-y-2">
              <Label>Caption</Label>
              <Input
                value={editingImage.caption || ""}
                onChange={(e) =>
                  setEditingImage({ ...editingImage, caption: e.target.value })
                }
                placeholder="Add a caption..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tag Staff Member</Label>
              <Select
                value={editingImage.staff_id || "none"}
                onValueChange={(value) =>
                  setEditingImage({
                    ...editingImage,
                    staff_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No staff</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingImage(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleUpdateImage(editingImage, {
                    caption: editingImage.caption,
                    staff_id: editingImage.staff_id,
                  });
                  setEditingImage(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
