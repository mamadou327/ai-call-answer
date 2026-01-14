import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQSection = () => {
  const faqs = [
    {
      question: "Can customers tell they're speaking to AI?",
      answer: "AIVIA uses natural language processing and sounds human-like. Most customers don't realize they're speaking to AI until told. The voice is warm, professional, and trained for your specific industry."
    },
    {
      question: "What if the AI makes a mistake?",
      answer: "All calls are recorded with full transcripts available in your dashboard. You can review and correct any bookings immediately. Customers also receive confirmation texts, giving them a chance to verify details."
    },
    {
      question: "How long does setup take?",
      answer: "Most businesses are up and running in under 10 minutes. Our guided onboarding walks you through everything step by step. Just add your services or menu, set your hours, and you're ready to go."
    },
    {
      question: "Do I need technical skills?",
      answer: "None at all. If you can use a smartphone, you can use AIVIA. Everything is designed to be simple and intuitive. Our support team is also available if you need any help."
    },
    {
      question: "What about my existing phone number?",
      answer: "You have two options: forward your current business number to AIVIA, or get a dedicated new AI number. Many businesses start with forwarding and find it works seamlessly."
    },
    {
      question: "Is there a contract or commitment?",
      answer: "No contracts whatsoever. Cancel anytime with one click. We offer a free 14-day trial so you can experience the benefits risk-free before deciding."
    },
    {
      question: "What happens if the AI can't handle a request?",
      answer: "AIVIA is trained to handle the vast majority of calls, but for unusual requests, it can take a message or offer to have someone call back. You're notified immediately of any calls that need your attention."
    },
    {
      question: "Does it work with my current booking system?",
      answer: "AIVIA includes its own powerful booking and order management system. All your appointments, orders, and customer data are accessible from one dashboard. No need for additional software."
    }
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-lg">
            Got questions? We've got answers.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="border-2 border-border bg-card px-6"
            >
              <AccordionTrigger className="text-left font-semibold hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
