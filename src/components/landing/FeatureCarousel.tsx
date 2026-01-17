import { useState, useEffect, useCallback } from "react";
import { Clock, CalendarCheck, BarChart3, Globe, UtensilsCrossed, Bell, Users, Mic, ShieldCheck, Phone, MessageSquare, Zap } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

// Group features into slides: each slide has 1 large (longest desc) + 2 small
const slides = [
  {
    large: {
      icon: Clock,
      title: "24/7 Instant Availability",
      description:
        "Answers every call in under 2 seconds, day or night. No hold times, no missed calls—even on weekends and holidays.",
    },
    small: [
      {
        icon: CalendarCheck,
        title: "Smart Booking",
        description:
          "Automatically schedules reservations and takes orders while checking real-time availability.",
      },
      {
        icon: BarChart3,
        title: "Live Analytics",
        description:
          "Track call volumes, booking rates, and revenue insights from your dashboard.",
      },
    ],
  },
  {
    large: {
      icon: UtensilsCrossed,
      title: "Order Taking",
      description:
        "Takes food orders accurately with full menu knowledge, including modifications and special requests.",
    },
    small: [
      {
        icon: Globe,
        title: "Multi-language Support",
        description:
          "Serve customers in their preferred language with automatic detection.",
      },
      {
        icon: Bell,
        title: "Appointment Reminders",
        description:
          "Automated SMS and email confirmations reduce no-shows.",
      },
    ],
  },
  {
    large: {
      icon: ShieldCheck,
      title: "No-Show Reduction",
      description:
        "Deposit collection and confirmation calls ensure customers show up and your revenue is protected.",
    },
    small: [
      {
        icon: Users,
        title: "CRM Integration",
        description:
          "Syncs customer data so you know who's calling instantly.",
      },
      {
        icon: Mic,
        title: "Custom Voice & Personality",
        description:
          "Tailor AIVIA's voice and tone to match your brand.",
      },
    ],
  },
  {
    large: {
      icon: Phone,
      title: "AI Phone Answering",
      description:
        "Never miss a call again. Our AI answers professionally, handles inquiries, and routes calls seamlessly 24/7.",
    },
    small: [
      {
        icon: MessageSquare,
        title: "SMS Notifications",
        description:
          "Automatic confirmations and follow-ups keep customers informed.",
      },
      {
        icon: Zap,
        title: "Instant Response",
        description:
          "Zero wait time means happier customers and more bookings.",
      },
    ],
  },
];

export function FeatureCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const scrollTo = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api]
  );

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on("select", onSelect);
    onSelect();

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Auto-play functionality
  useEffect(() => {
    if (!api || isPaused) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, 6000);

    return () => clearInterval(interval);
  }, [api, isPaused]);

  return (
    <section className="mt-16 md:mt-24 w-full max-w-6xl mx-auto px-4">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Why AIVIA
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Your AI receptionist that never sleeps, never misses a call, and always delivers
        </p>
      </div>

      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <Carousel
          setApi={setApi}
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {slides.map((slide, slideIndex) => {
              const LargeIcon = slide.large.icon;
              const isActive = current === slideIndex;

              return (
                <CarouselItem
                  key={slideIndex}
                  className="pl-4 basis-full"
                >
                  <div className={cn(
                    "grid grid-cols-1 md:grid-cols-2 gap-4 h-full",
                    slideIndex % 2 === 1 && "md:flex md:flex-row-reverse"
                  )}>
                    {/* Large card */}
                    <div
                      className={cn(
                        "group relative rounded-2xl border bg-card p-8 transition-all duration-300 flex flex-col justify-center md:flex-1",
                        "hover:shadow-lg hover:border-primary/30",
                        isActive && "border-primary/50 shadow-md"
                      )}
                    >
                      <div
                        className={cn(
                          "mb-5 inline-flex items-center justify-center rounded-xl p-4 transition-colors duration-300 w-fit",
                          "bg-gradient-to-br from-primary/15 to-primary/5",
                          "group-hover:from-primary/25 group-hover:to-primary/10"
                        )}
                      >
                        <LargeIcon className="h-8 w-8 text-primary" />
                      </div>

                      <h3 className="text-xl font-semibold text-foreground mb-3">
                        {slide.large.title}
                      </h3>

                      <p className="text-muted-foreground leading-relaxed">
                        {slide.large.description}
                      </p>
                    </div>

                    {/* Two small cards stacked */}
                    <div className="flex flex-col gap-4 md:flex-1">
                      {slide.small.map((feature, featureIndex) => {
                        const SmallIcon = feature.icon;
                        return (
                          <div
                            key={featureIndex}
                            className={cn(
                              "group relative flex-1 rounded-2xl border bg-card p-5 transition-all duration-300",
                              "hover:shadow-md hover:border-primary/30"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={cn(
                                  "flex-shrink-0 inline-flex items-center justify-center rounded-lg p-3 transition-colors duration-300",
                                  "bg-gradient-to-br from-primary/10 to-primary/5",
                                  "group-hover:from-primary/20 group-hover:to-primary/10"
                                )}
                              >
                                <SmallIcon className="h-5 w-5 text-primary" />
                              </div>

                              <div>
                                <h3 className="text-base font-semibold text-foreground mb-1">
                                  {feature.title}
                                </h3>

                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {feature.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        {/* Navigation Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                current === index
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
