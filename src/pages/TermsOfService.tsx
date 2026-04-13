import { Link } from "react-router-dom";
import aiviaLogo from "@/assets/aivia-logo-new.png";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={aiviaLogo} alt="Aivia" className="h-8 w-auto" />
            <span className="text-xl font-bold">AIVIA</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using AIVIA's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">
              AIVIA provides an AI-powered phone assistant that answers calls, takes bookings, processes orders, and manages customer communications on behalf of businesses. Our service includes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>AI voice assistant for inbound calls</li>
              <li>Booking and reservation management</li>
              <li>Order processing for restaurants</li>
              <li>SMS and email notifications</li>
              <li>Customer management dashboard</li>
              <li>Call recording and transcription</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Account Registration</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>You must provide accurate and complete information during registration</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must be at least 18 years old to create an account</li>
              <li>One business per account unless otherwise agreed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Business Owner Responsibilities</h2>
            <p className="text-muted-foreground">As a business owner using AIVIA, you agree to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Provide accurate business information including opening hours and services</li>
              <li>Keep your menu, pricing, and availability information up to date</li>
              <li>Comply with all applicable laws regarding customer data handling</li>
              <li>Inform your customers that calls may be handled by an AI assistant</li>
              <li>Respond to customer inquiries forwarded by AIVIA in a timely manner</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Guest/Customer Data</h2>
            <p className="text-muted-foreground">
              When guests interact with AIVIA on behalf of your business, we collect and process their data as described in our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. You acknowledge that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Guest data collected through AIVIA is shared with you for service delivery</li>
              <li>You must handle guest data in compliance with GDPR and applicable privacy laws</li>
              <li>You may not use guest data for purposes beyond the original booking/order context without consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. AI Limitations</h2>
            <p className="text-muted-foreground">
              AIVIA's AI assistant is designed to handle common customer interactions accurately, but:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>The AI may occasionally misunderstand or provide incorrect information</li>
              <li>Complex or unusual requests may require human follow-up</li>
              <li>AIVIA is not a substitute for professional medical, legal, or emergency services</li>
              <li>You should regularly review call logs and bookings for accuracy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Payment Terms</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Subscription fees are billed according to your selected plan</li>
              <li>All fees are exclusive of applicable taxes</li>
              <li>Refunds are handled on a case-by-case basis</li>
              <li>We reserve the right to change pricing with 30 days' notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Termination</h2>
            <p className="text-muted-foreground">
              Either party may terminate the service at any time. Upon termination:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Your AI phone number will be deactivated</li>
              <li>You may request export of your business data within 30 days</li>
              <li>Guest data will be retained per our Privacy Policy retention schedule</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              AIVIA shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services, including but not limited to missed bookings, incorrect orders, or lost revenue due to AI errors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these terms from time to time. We will notify registered users of material changes via email. Continued use of the service constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these terms, contact us at:<br />
              Email: <strong>legal@aivia.app</strong>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
