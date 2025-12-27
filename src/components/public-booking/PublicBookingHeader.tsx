import { useState } from "react";
import { Menu, X, Home, Scissors, ImageIcon, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PublicSocialLinks } from "./PublicSocialLinks";
import { PublicMiniCart } from "./PublicMiniCart";
import { CartItem } from "./PublicBookingCart";

interface Socials {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  twitter: string | null;
  youtube: string | null;
}

interface PublicBookingHeaderProps {
  businessName: string;
  logoUrl: string | null;
  socials: Socials;
  hasGallery: boolean;
  currentStep: string;
  cartItems: CartItem[];
  currency: string;
  onNavigate: (step: "landing" | "service" | "gallery") => void;
  onOpenContact: () => void;
  onRemoveCartItem: (itemId: string) => void;
  onCartContinue: () => void;
  onCartAddAnother: () => void;
}

const navItems = [
  { id: "landing", label: "Home", icon: Home },
  { id: "service", label: "Services", icon: Scissors },
  { id: "gallery", label: "Gallery", icon: ImageIcon },
] as const;

export const PublicBookingHeader = ({
  businessName,
  logoUrl,
  socials,
  hasGallery,
  currentStep,
  cartItems,
  currency,
  onNavigate,
  onOpenContact,
  onRemoveCartItem,
  onCartContinue,
  onCartAddAnother,
}: PublicBookingHeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (stepId: "landing" | "service" | "gallery") => {
    onNavigate(stepId);
    setMobileMenuOpen(false);
  };

  const isActive = (stepId: string) => {
    if (stepId === "landing") return currentStep === "landing";
    if (stepId === "service") return ["service", "staff", "datetime", "customer", "group-type", "group-customer"].includes(currentStep);
    if (stepId === "gallery") return currentStep === "gallery";
    return false;
  };

  const showCart = cartItems.length > 0 && !["landing", "confirmation"].includes(currentStep);

  // Filter gallery if business doesn't have one
  const visibleNavItems = navItems.filter(item => {
    if (item.id === "gallery" && !hasGallery) return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Business Name */}
          <button 
            onClick={() => handleNavClick("landing")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt={businessName} 
                className="h-10 w-10 object-contain rounded-lg"
              />
            )}
            <span className="font-bold text-lg hidden sm:block">{businessName}</span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleNavItems.map((item) => (
              <Button
                key={item.id}
                variant={isActive(item.id) ? "default" : "ghost"}
                size="sm"
                onClick={() => handleNavClick(item.id)}
                className="gap-2"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenContact}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Contact
            </Button>
          </nav>

          {/* Right side: CTA, Cart, Social, Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Book Now CTA - Desktop */}
            {currentStep !== "service" && (
              <Button
                size="sm"
                onClick={() => handleNavClick("service")}
                className="hidden md:flex gap-2"
              >
                <Calendar className="h-4 w-4" />
                Book Now
              </Button>
            )}

            {/* Mini Cart */}
            {showCart && (
              <PublicMiniCart
                items={cartItems}
                currency={currency}
                onRemoveItem={onRemoveCartItem}
                onContinue={onCartContinue}
                onAddAnother={onCartAddAnother}
              />
            )}

            {/* Social Links - Desktop */}
            <div className="hidden md:block">
              <PublicSocialLinks socials={socials} />
            </div>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col h-full">
                  {/* Mobile Nav Header */}
                  <div className="flex items-center gap-3 pb-6 border-b">
                    {logoUrl && (
                      <img 
                        src={logoUrl} 
                        alt={businessName} 
                        className="h-10 w-10 object-contain rounded-lg"
                      />
                    )}
                    <span className="font-bold text-lg">{businessName}</span>
                  </div>

                  {/* Mobile Nav Items */}
                  <nav className="flex flex-col gap-1 py-6">
                    {visibleNavItems.map((item) => (
                      <Button
                        key={item.id}
                        variant={isActive(item.id) ? "default" : "ghost"}
                        className="justify-start gap-3 h-12"
                        onClick={() => handleNavClick(item.id)}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      className="justify-start gap-3 h-12"
                      onClick={() => {
                        onOpenContact();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <MessageSquare className="h-5 w-5" />
                      Contact
                    </Button>
                  </nav>

                  {/* Book Now CTA - Mobile */}
                  <div className="pt-4 border-t">
                    <Button
                      className="w-full gap-2 h-12"
                      onClick={() => handleNavClick("service")}
                    >
                      <Calendar className="h-5 w-5" />
                      Book Now
                    </Button>
                  </div>

                  {/* Social Links - Mobile */}
                  <div className="mt-auto pt-6 border-t">
                    <p className="text-sm text-muted-foreground mb-3">Follow us</p>
                    <PublicSocialLinks socials={socials} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};
