import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import LegalFooter from "@/components/LegalFooter";
import { Button } from "@/components/ui/button";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-3 text-foreground">{title}</h2>
    <div className="text-foreground/80 leading-relaxed space-y-2">{children}</div>
  </section>
);

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={aiviaLogo} alt="Aivia" className="h-8 w-auto" />
            <span className="text-xl font-bold">AIVIA</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <h1 className="text-4xl font-bold mb-2">Aivia Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: July 2026</p>

        <Section title="1. Who we are">
          <p>
            Aivia ("we", "us", "our") is operated by Aivia Ltd. We provide an AI-powered phone
            receptionist and booking management platform for service businesses in the United
            Kingdom. Our website is{" "}
            <a href="https://aiviaapp.co.uk" className="text-primary hover:underline">
              aiviaapp.co.uk
            </a>
            . For any data protection queries contact us at{" "}
            <a href="mailto:privacy@aiviaapp.co.uk" className="text-primary hover:underline">
              privacy@aiviaapp.co.uk
            </a>
            .
          </p>
        </Section>

        <Section title="2. What data we collect">
          <p>We collect and process the following personal data:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Business owner data:</strong> name, email address, phone number, business
              address, payment information
            </li>
            <li>
              <strong>Caller data:</strong> phone number, name (when provided), call recordings,
              call transcripts, booking details, SMS messages sent
            </li>
            <li>
              <strong>Website visitor data:</strong> IP address, browser type, pages visited via
              standard analytics
            </li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <p>We use personal data to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide our AI receptionist and booking management service</li>
            <li>Answer inbound calls and make bookings on behalf of our client businesses</li>
            <li>Send SMS booking confirmations, reminders, and cancellation notices</li>
            <li>Send push notifications about new bookings and messages</li>
            <li>Improve our AI service quality through call recording analysis</li>
            <li>Process payments and manage subscriptions</li>
            <li>Communicate service updates and support</li>
          </ul>
        </Section>

        <Section title="4. Call recording">
          <p>
            All calls handled by our AI receptionist are recorded for quality assurance and service
            improvement. Callers are informed at the start of each call that the call may be
            recorded. Call recordings are stored securely and retained for 90 days unless the
            business owner requests earlier deletion.
          </p>
        </Section>

        <Section title="5. AI disclosure">
          <p>
            Our service uses artificial intelligence to handle phone calls. The AI system answers
            calls, responds to questions, and makes bookings. Call recordings and transcripts may
            be analysed to improve AI performance.
          </p>
        </Section>

        <Section title="6. Lawful basis">
          <p>We process personal data under the following lawful bases under UK GDPR:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Legitimate interest:</strong> to provide and improve our services
            </li>
            <li>
              <strong>Contract performance:</strong> to fulfil our service agreement with business
              owners
            </li>
            <li>
              <strong>Consent:</strong> where explicitly obtained, such as for marketing
              communications
            </li>
          </ul>
        </Section>

        <Section title="7. Data sharing">
          <p>
            We do not sell personal data. We share data with the following categories of service
            providers who process data on our behalf:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Twilio (telephony and SMS)</li>
            <li>OpenAI (AI language processing)</li>
            <li>ElevenLabs (voice synthesis)</li>
            <li>Supabase (database hosting)</li>
            <li>Stripe (payment processing)</li>
          </ul>
          <p>
            All processors are bound by data processing agreements and process data in accordance
            with UK GDPR.
          </p>
        </Section>

        <Section title="8. Data retention">
          <ul className="list-disc pl-6 space-y-1">
            <li>Call recordings: 90 days</li>
            <li>Call transcripts: retained for the duration of the business subscription</li>
            <li>Booking data: retained for the duration of the business subscription</li>
            <li>Account data: retained until account deletion</li>
          </ul>
        </Section>

        <Section title="9. Your rights">
          <p>Under UK GDPR you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access your personal data</li>
            <li>Rectify inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Restrict processing</li>
            <li>Data portability</li>
            <li>Object to processing</li>
          </ul>
          <p>
            To exercise any of these rights contact{" "}
            <a href="mailto:privacy@aiviaapp.co.uk" className="text-primary hover:underline">
              privacy@aiviaapp.co.uk
            </a>
            .
          </p>
        </Section>

        <Section title="10. Data security">
          <p>
            We implement appropriate technical and organisational measures to protect personal data
            including encryption in transit and at rest, access controls, and regular security
            reviews.
          </p>
        </Section>

        <Section title="11. Cookies">
          <p>
            We use essential cookies to maintain user sessions. We do not use advertising or
            tracking cookies.
          </p>
        </Section>

        <Section title="12. Changes to this policy">
          <p>
            We may update this policy from time to time. Significant changes will be communicated
            via email to registered users.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            For any privacy-related questions contact{" "}
            <a href="mailto:privacy@aiviaapp.co.uk" className="text-primary hover:underline">
              privacy@aiviaapp.co.uk
            </a>
            .
          </p>
        </Section>
      </main>

      <LegalFooter />
    </div>
  );
};

export default PrivacyPolicy;
