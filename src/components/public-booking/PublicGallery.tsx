import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Filter, X } from "lucide-react";

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  staff_id: string | null;
}

interface Staff {
  id: string;
  name: string;
}

interface PublicGalleryProps {
  businessId: string;
  onBack: () => void;
}

export const PublicGallery = ({ businessId, onBack }: PublicGalleryProps) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [businessId]);

  const loadData = async () => {
    const [galleryResult, staffResult] = await Promise.all([
      supabase
        .from("business_gallery")
        .select("id, image_url, caption, staff_id")
        .eq("business_id", businessId)
        .order("display_order", { ascending: true }),
      supabase
        .from("public_staff" as any)
        .select("id, name")
        .eq("business_id", businessId)
        .eq("ai_enabled", true),
    ]);

    if (galleryResult.data) setImages(galleryResult.data);
    if (staffResult.data) setStaff(staffResult.data);
    setLoading(false);
  };

  const filteredImages = selectedStaff
    ? images.filter((img) => img.staff_id === selectedStaff)
    : images;

  const staffWithPhotos = staff.filter((s) =>
    images.some((img) => img.staff_id === s.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-xl font-semibold">Our Work</h2>
        <div className="w-20" /> {/* Spacer for centering */}
      </div>

      {/* Staff Filter */}
      {staffWithPhotos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={selectedStaff === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStaff(null)}
          >
            All
          </Button>
          {staffWithPhotos.map((s) => (
            <Button
              key={s.id}
              variant={selectedStaff === s.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStaff(s.id)}
            >
              {s.name}
            </Button>
          ))}
        </div>
      )}

      {/* Gallery Grid */}
      {filteredImages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No photos to display</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className="relative cursor-pointer group"
              onClick={() => setSelectedImage(image)}
            >
              <img
                src={image.image_url}
                alt={image.caption || "Gallery image"}
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
              {image.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 rounded-b-lg">
                  <p className="text-white text-sm truncate">{image.caption}</p>
                </div>
              )}
              {image.staff_id && (
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {staff.find((s) => s.id === image.staff_id)?.name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setSelectedImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={selectedImage.image_url}
            alt={selectedImage.caption || "Gallery image"}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedImage.caption && (
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white text-lg bg-black/50 inline-block px-4 py-2 rounded">
                {selectedImage.caption}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
