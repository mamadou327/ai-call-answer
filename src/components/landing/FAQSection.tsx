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
      answer: "AIVIA uses advanced natural language processing and sounds remarkably human-like. Most customers don't realize they're speaking to AI until told. The voice is warm, professional, and trained specifically for your industry."
    },
    {
      question: "Will this stop missed calls during busy hours?",
      answer: "Absolutely. AIVIA answers every call instantly, 24/7, even when you're with customers, during rush hours, or after closing. No more missed opportunities or voicemails that never get returned."
    },
    {
      question: "Can it handle multiple calls at the same time?",
      answer: "Yes! Unlike a human receptionist, AIVIA can handle unlimited simultaneous calls. Whether you get 2 calls or 200 at once, every customer gets immediate attention without waiting."
    },
    {
      question: "Can it take reservations and food orders?",
      answer: "Yes, AIVIA handles both seamlessly. For restaurants, it can take table reservations with party size and special requests, as well as complete takeaway orders with customizations. Everything appears instantly in your dashboard."
    },
    {
      question: "What happens if a customer calls after closing time?",
      answer: "AIVIA works 24/7, so after-hours calls are handled just like daytime calls. It can take bookings, orders, and messages anytime. Customers love being able to book at their convenience, even at midnight."
    },
    {
      question: "Can I keep my existing phone number?",
      answer: "Yes! You can simply forward your current business number to AIVIA, or get a dedicated new AI number. Many businesses start with call forwarding and find it works seamlessly with no customer disruption."
    },
    {
      question: "How long does setup take?",
      answer: "Most businesses are up and running in under 10 minutes. Our guided onboarding walks you through everything step by step. Just add your services or menu, set your hours, and you're ready to go."
    },
    {
      question: "Do I need any technical skills to use this?",
      answer: "None at all. If you can use a smartphone, you can use AIVIA. Everything is designed to be simple and intuitive with a clean dashboard. Our support team is also available if you need any help."
    },
    {
      question: "What happens if the AI can't handle a request?",
      answer: "AIVIA is trained to handle the vast majority of calls, but for unusual requests, it can take a detailed message or offer to have someone call back. You're notified immediately of any calls that need your personal attention."
    },
    {
      question: "Will customers ever be put on hold?",
      answer: "Never. Every call is answered instantly, and since AIVIA can handle unlimited calls simultaneously, there's no waiting queue. Customers get immediate service every single time."
    },
    {
      question: "Can it answer menu questions and common customer enquiries?",
      answer: "Yes! AIVIA learns your menu, services, prices, opening hours, and policies. It can answer questions like 'Do you have vegetarian options?', 'What time do you close?', or 'Do you offer delivery?' – all without involving your staff."
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
