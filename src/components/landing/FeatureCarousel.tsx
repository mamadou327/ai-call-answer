import { useState, useEffect, useCallback } from "react";
import { Clock, CalendarCheck, BarChart3, Globe } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Clock,
    title: "24/7 Instant Availability",
    description:
      "Answers every call in under 2 seconds, day or night. No hold times, no missed calls—even on weekends and holidays.",
  },
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
      "Track call volumes, booking rates, and revenue insights from your dashboard in real-time.",
  },
  {
    icon: Globe,
    title: "Multi-language Support",
    description:
      "Serve customers in their preferred language with automatic detection and response.",
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
    }, 5000);

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
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = current === index;

              return (
                <CarouselItem
                  key={feature.title}
                  className="pl-4 basis-full md:basis-1/2 lg:basis-1/3"
                >
                  <div
                    className={cn(
                      "group relative h-full rounded-2xl border bg-card p-6 transition-all duration-300",
                      "hover:shadow-lg hover:scale-[1.02] hover:border-primary/30",
                      isActive && "border-primary/50 shadow-md scale-[1.01]"
                    )}
                  >
                    <div
                      className={cn(
                        "mb-4 inline-flex items-center justify-center rounded-xl p-3 transition-colors duration-300",
                        "bg-gradient-to-br from-primary/10 to-primary/5",
                        "group-hover:from-primary/20 group-hover:to-primary/10"
                      )}
                    >
                      <Icon className="h-6 w-6 text-primary" />
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        {/* Navigation Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {features.map((_, index) => (
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
