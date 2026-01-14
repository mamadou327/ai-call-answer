import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const TestimonialsSection = () => {
  const testimonials = [
    {
      quote: "AIVIA has been a game-changer for my barbershop. I never miss a booking now, even when I'm busy with clients.",
      author: "Marcus T.",
      business: "Barbershop Owner",
      location: "London",
      rating: 5
    },
    {
      quote: "Our takeaway orders increased by 30% since we started using AIVIA. The AI knows our menu better than some of my staff!",
      author: "Lisa M.",
      business: "Restaurant Owner",
      location: "Manchester",
      rating: 5
    },
    {
      quote: "I was skeptical about AI answering phones at first, but now I can't imagine running my salon without AIVIA.",
      author: "Sarah K.",
      business: "Hair Salon Owner",
      location: "Birmingham",
      rating: 5
    }
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">What Business Owners Say</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Join hundreds of UK businesses that trust AIVIA with their calls
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <Card key={index} className="border-2 border-border bg-card">
            <CardContent className="p-6">
              {/* Star Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-warning text-warning" />
                ))}
              </div>

              {/* Quote */}
              <div className="relative mb-6">
                <Quote className="absolute -top-2 -left-2 w-8 h-8 text-muted-foreground/20" />
                <p className="text-foreground relative z-10 pl-4">"{testimonial.quote}"</p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted border border-border flex items-center justify-center font-bold text-sm">
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{testimonial.author}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.business}, {testimonial.location}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default TestimonialsSection;
