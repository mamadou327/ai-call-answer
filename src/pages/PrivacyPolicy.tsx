import { Link } from "react-router-dom";
import aiviaLogo from "@/assets/aivia-logo-new.png";

const PrivacyPolicy = () => {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Who We Are</h2>
            <p className="text-muted-foreground">
              AIVIA ("we", "us", "our") provides AI-powered phone assistant services for businesses including salons, restaurants, and other service-based businesses. This Privacy Policy explains how we collect, use, store, and protect personal data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Data We Collect</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">Business Owner Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name, email address, phone number</li>
              <li>Business name, address, and contact details</li>
              <li>Business settings and configuration preferences</li>
              <li>Payment and billing information (processed securely via Stripe)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Guest/Customer Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name, phone number, and email (when provided during booking or ordering)</li>
              <li>Booking details: date, time, party size, special requests</li>
              <li>Dietary requirements and allergen information</li>
              <li>Call recordings and transcriptions (when calls are handled by AIVIA)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Automatically Collected Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Call metadata: caller phone number, call duration, timestamps</li>
              <li>Browser type, IP address, and device information when using our website</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>To provide AI-powered phone answering and booking services</li>
              <li>To send booking confirmations, reminders, and notifications via SMS/email</li>
              <li>To process payments and deposits</li>
              <li>To improve our AI assistant's accuracy and capabilities</li>
              <li>To provide customer support</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Legal Basis for Processing (GDPR)</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Contract performance:</strong> Processing necessary to provide our services</li>
              <li><strong>Legitimate interests:</strong> Improving our services, fraud prevention</li>
              <li><strong>Consent:</strong> Marketing communications (opt-in only)</li>
              <li><strong>Legal obligation:</strong> Tax, accounting, and regulatory requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Sharing</h2>
            <p className="text-muted-foreground">We do not sell personal data. We share data only with:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Business owners:</strong> Guest data is shared with the business that the guest is booking with</li>
              <li><strong>Service providers:</strong> Twilio (calls/SMS), Stripe (payments), cloud hosting providers</li>
              <li><strong>Legal authorities:</strong> When required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Retention</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Call recordings: retained for 90 days, then automatically deleted</li>
              <li>Booking data: retained for the duration of the business's subscription plus 12 months</li>
              <li>Account data: retained until account deletion is requested</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Rights (GDPR)</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Restriction:</strong> Limit how we process your data</li>
              <li><strong>Portability:</strong> Receive your data in a portable format</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              To exercise these rights, contact us at <strong>privacy@aivia.app</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Security</h2>
            <p className="text-muted-foreground">
              We use industry-standard security measures including encryption in transit (TLS), encryption at rest, access controls, and regular security audits. Our infrastructure is hosted on secure cloud platforms with SOC 2 compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Cookies</h2>
            <p className="text-muted-foreground">
              We use essential cookies for authentication and session management. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy-related inquiries, contact us at:<br />
              Email: <strong>privacy@aivia.app</strong>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
