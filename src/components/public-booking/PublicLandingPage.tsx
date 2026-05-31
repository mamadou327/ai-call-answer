import { useState } from "react";
import {
  XCircle,
  RefreshCw,
  MapPin,
  Phone,
  Globe,
  FileText,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Clock,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PublicContactForm } from "./PublicContactForm";
import { PoweredByAivia } from "./PoweredByAivia";

interface PolicySettings {
  minBookingNoticeHours: number | null;
  maxDaysAdvance: number | null;
  minCancellationNoticeHours: number | null;
  minRescheduleNoticeHours: number | null;
  cancellationPolicy: string | null;
}

interface OpeningHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface Socials {
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  twitter?: string | null;
  youtube?: string | null;
}

interface ServicePreview {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface PublicLandingPageProps {
  businessName: string;
  businessSlug: string;
  businessType?: string | null;
  welcomeMessage: string | null;
  address: string;
  phone: string;
  website: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  
  aboutDescription?: string | null;
  socials?: Socials;
  services?: ServicePreview[];
  galleryImages?: string[];
  currency?: string;
  hasGallery: boolean;
  policies?: PolicySettings;
  openingHours?: OpeningHour[];
  onMakeBooking: () => void;
  onSelectService?: (serviceId: string) => void;
  onCancelBooking: () => void;
  onRescheduleBooking: () => void;
  onViewGallery: () => void;
}

const RESTAURANT_TYPES = ["restaurant_pickup", "restaurant_dine_in", "restaurant_hybrid"];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatTime12 = (time: string | null): string => {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
};

const formatUrl = (url: string | null | undefined, defaultPrefix: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url.startsWith(defaultPrefix) ? "" : defaultPrefix}${url}`;
};

const formatPolicyText = (rawPolicy: string): string => {
  let formatted = rawPolicy.trim();
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  if (formatted.length > 0 && !formatted.match(/[.!?]$/)) formatted += ".";
  return formatted;
};

const formatPrice = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

export const PublicLandingPage = ({
  businessName,
  businessSlug,
  businessType,
  welcomeMessage,
  address,
  phone,
  website,
  logoUrl,
  heroImageUrl,
  aboutDescription,
  socials,
  services = [],
  galleryImages = [],
  currency = "GBP",
  hasGallery,
  policies,
  openingHours,
  onMakeBooking,
  onSelectService,
  onCancelBooking,
  onRescheduleBooking,
  onViewGallery,
}: PublicLandingPageProps) => {
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const isRestaurant = RESTAURANT_TYPES.includes(businessType || "");
  
  const heroServices = services.slice(0, 6);
  const heroGallery = galleryImages.slice(0, 4);
  const subtitle = welcomeMessage || aboutDescription;

  const formatPolicyItem = (label: string, value: number | null, unit: string) => {
    if (value === null) return null;
    return (
      <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} {unit}</span>
      </div>
    );
  };

  return (
    <div className="font-sans">
      {/* 1. Hero */}
      <section className="relative -mx-4 mb-20">
        {heroImageUrl ? (
          <div className="relative w-full h-[260px] md:h-[380px] overflow-hidden">
            <img
              src={heroImageUrl}
              alt={`${businessName} cover`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
          </div>
        ) : (
          <div className="w-full h-[200px] md:h-[260px] bg-gradient-to-br from-primary/15 to-background" />

        )}

        {/* Logo + Name overlapping bottom of hero */}
        <div className="absolute left-0 right-0 -bottom-16 px-4">
          <div className="max-w-4xl mx-auto flex items-end gap-4">
            <div className="shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${businessName} logo`}
                  className="h-20 w-20 rounded-full object-cover border-[3px] border-white shadow-lg bg-white"
                />
              ) : (
                <div
                  className="h-20 w-20 rounded-full border-[3px] border-white shadow-lg flex items-center justify-center text-primary-foreground bg-primary font-bold text-2xl"
                >

                  {businessName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="pb-2 min-w-0 flex-1">
              <h1 className="text-[22px] md:text-[28px] font-bold leading-tight text-foreground truncate">
                {businessName}
              </h1>
              {subtitle && (
                <p className="text-sm md:text-base text-muted-foreground font-normal line-clamp-2 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Action bar */}
      <section className="flex flex-col items-center gap-4 mb-10">
        <Button
          onClick={onMakeBooking}
          className="rounded-full px-10 h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all hover:opacity-90"
        >
          {isRestaurant ? "Order Now" : "Book Now"}
        </Button>

        {socials && (socials.instagram || socials.facebook || socials.tiktok || socials.twitter || socials.youtube) && (
          <div className="flex items-center gap-3">
            {socials.instagram && (
              <a
                href={formatUrl(socials.instagram, "instagram.com/")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform"
                style={{ background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {socials.facebook && (
              <a
                href={formatUrl(socials.facebook, "facebook.com/")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform"
                style={{ background: "#1877F2" }}
              >
                <Facebook className="h-4 w-4" />
              </a>
            )}
            {socials.tiktok && (
              <a
                href={formatUrl(socials.tiktok, "tiktok.com/@")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform bg-black"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
            )}
            {socials.twitter && (
              <a
                href={formatUrl(socials.twitter, "twitter.com/")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform bg-black"
              >
                <Twitter className="h-4 w-4" />
              </a>
            )}
            {socials.youtube && (
              <a
                href={formatUrl(socials.youtube, "youtube.com/@")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform"
                style={{ background: "#FF0000" }}
              >
                <Youtube className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </section>

      {/* 3. About */}
      {aboutDescription && (
        <section className="mb-10">
          <Card className="p-5 md:p-6 border bg-card/50">
            <p className="text-[15px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
              {aboutDescription}
            </p>
          </Card>
        </section>
      )}

      {/* 4. Services preview */}
      {!isRestaurant && heroServices.length > 0 && (
        <section className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-lg font-semibold">Services</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {heroServices.map((service) => (
              <button
                key={service.id}
                onClick={() =>
                  onSelectService ? onSelectService(service.id) : onMakeBooking()
                }
                className="group text-left p-4 rounded-xl border bg-card hover:shadow-md transition-all hover:-translate-y-0.5"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <div className="font-semibold text-foreground mb-1 group-hover:opacity-90">
                  {service.name}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {service.duration_minutes} min
                  </span>
                  <span className="font-semibold text-primary">
                    {formatPrice(Number(service.price), currency)}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={onMakeBooking}
              className="text-sm font-medium text-primary"
            >
              See all services →
            </Button>
          </div>
        </section>
      )}

      {/* 5. Gallery preview */}
      {hasGallery && heroGallery.length > 0 && (
        <section className="mb-10">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-semibold">
              {isRestaurant ? "From the menu" : "Our work"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewGallery}
              className="text-sm text-primary"
            >
              View all
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {heroGallery.map((url, i) => (
              <button
                key={i}
                onClick={onViewGallery}
                className="shrink-0 snap-start rounded-xl overflow-hidden border bg-muted hover:opacity-90 transition-opacity"
                aria-label="Open gallery"
              >
                <img
                  src={url}
                  alt=""
                  className="h-32 w-32 md:h-36 md:w-36 object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 6. Info section */}
      <section className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-sm">
          <div className="flex items-start gap-3 text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span className="leading-snug">{address}</span>
          </div>
          <div className="flex items-start gap-3 text-muted-foreground">
            <Phone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <a
              href={`tel:${phone}`}
              className="hover:text-foreground transition-colors leading-snug"
            >
              {phone}
            </a>
          </div>
          {openingHours && openingHours.length > 0 && (
            <Collapsible open={hoursOpen} onOpenChange={setHoursOpen}>
              <CollapsibleTrigger className="flex items-center gap-3 text-muted-foreground w-full text-left hover:text-foreground transition-colors">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <span className="leading-snug flex-1">Opening hours</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${hoursOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 ml-7 space-y-1">
                {openingHours.map((h) => (
                  <div
                    key={h.day_of_week}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>{DAY_NAMES[h.day_of_week]}</span>
                    <span>
                      {h.is_closed
                        ? "Closed"
                        : `${formatTime12(h.open_time)} – ${formatTime12(h.close_time)}`}
                    </span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {website && (
          <div className="mt-4 text-sm">
            <a
              href={website.startsWith("http") ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-4 w-4 text-primary" />
              Visit website
            </a>
          </div>
        )}
      </section>

      {/* 7. Footer */}
      <footer className="pt-6 border-t mt-10">
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            <button
              onClick={onCancelBooking}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel booking
            </button>
            <button
              onClick={onRescheduleBooking}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reschedule
            </button>

            <Dialog open={policiesOpen} onOpenChange={setPoliciesOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <FileText className="h-3.5 w-3.5" />
                  Policies
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Booking Policies</DialogTitle>
                  <DialogDescription>
                    Our booking, cancellation, and rescheduling policies
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1 mt-4">
                  {policies?.minBookingNoticeHours != null &&
                    formatPolicyItem("Minimum booking notice", policies.minBookingNoticeHours, "hours")}
                  {policies?.maxDaysAdvance != null &&
                    formatPolicyItem("Book up to", policies.maxDaysAdvance, "days in advance")}
                  {policies?.minCancellationNoticeHours != null &&
                    formatPolicyItem(
                      "Cancellation notice required",
                      policies.minCancellationNoticeHours,
                      "hours"
                    )}
                  {policies?.minRescheduleNoticeHours != null &&
                    formatPolicyItem(
                      "Reschedule notice required",
                      policies.minRescheduleNoticeHours,
                      "hours"
                    )}
                  {policies?.cancellationPolicy && (
                    <div className="pt-4 mt-4 border-t">
                      <h4 className="font-medium mb-2">Policy</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {formatPolicyText(policies.cancellationPolicy)}
                      </p>
                    </div>
                  )}
                  {!policies?.minBookingNoticeHours &&
                    !policies?.maxDaysAdvance &&
                    !policies?.minCancellationNoticeHours &&
                    !policies?.minRescheduleNoticeHours &&
                    !policies?.cancellationPolicy && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No specific policies have been set by this business.
                      </p>
                    )}
                </div>
              </DialogContent>
            </Dialog>

            <button
              onClick={() => setContactOpen(true)}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Contact
            </button>
            <PublicContactForm
              businessSlug={businessSlug}
              businessName={businessName}
              open={contactOpen}
              onOpenChange={setContactOpen}
              showTrigger={false}
            />
          </div>

          <PoweredByAivia />
        </div>
      </footer>
    </div>
  );
};
