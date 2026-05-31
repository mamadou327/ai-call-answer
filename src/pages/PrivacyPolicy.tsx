import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import LegalFooter from "@/components/LegalFooter";
import { Button } from "@/components/ui/button";

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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">
          Last updated: 29 May 2025<br />
          Applies to: aiviaapp.co.uk and all Aivia platform services
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Who We Are</h2>
            <p className="text-muted-foreground">
              Aivia is an AI-powered business management platform with a built-in AI receptionist, built for service sector businesses including restaurants, salons, barbershops, beauty clinics, healthcare providers, tradespeople and any other business that takes bookings, reservations or customer enquiries by phone or online.
            </p>
            <p className="text-muted-foreground mt-2">
              Aivia is developed and operated by Mo Laye trading as Aivia.
            </p>
            <p className="text-muted-foreground mt-2">
              Contact: <strong>mo@aiviaapp.co.uk</strong><br />
              Privacy contact: <strong>privacy@aiviaapp.co.uk</strong><br />
              Website: <a href="https://aiviaapp.co.uk" className="text-primary hover:underline">https://aiviaapp.co.uk</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Data We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Business Owners and Staff (our direct customers)</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name, email address and password when creating an Aivia account</li>
              <li>Business name, address, services, pricing and branding information</li>
              <li>Staff names, roles, email addresses and phone numbers</li>
              <li>Subscription and payment information processed via Stripe</li>
              <li>Usage data including bookings created, calls handled and dashboard activity</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 End Clients (customers of businesses using Aivia)</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name and phone number when booking via phone through the Aivia AI receptionist</li>
              <li>Name, email address and phone number when booking online via the Aivia booking widget</li>
              <li>Appointment, reservation or order history and preferences</li>
              <li>Voice call recordings and transcripts where the business has enabled call recording</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Website Visitors</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>No personal data is collected from visitors to aiviaapp.co.uk beyond standard server logs</li>
              <li>We do not use Google Analytics, tracking pixels or any third party analytics tools</li>
              <li>Fonts are self-hosted and no visitor data is sent to Google or any third party</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Data</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">3.1 To provide the Aivia service</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Creating and managing business accounts, booking calendars and client records</li>
              <li>Enabling the AI receptionist to answer calls, take bookings and handle customer enquiries</li>
              <li>Processing online bookings and reservations through the Aivia booking widget</li>
              <li>Sending booking confirmations and reminders via SMS and email</li>
              <li>Processing subscription payments through Stripe</li>
              <li>Enabling businesses to import their existing information and client data into Aivia</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">3.2 Legal basis for processing (UK GDPR)</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Contract:</strong> processing necessary to deliver the Aivia service to our business customers</li>
              <li><strong>Legitimate interests:</strong> improving platform security, preventing fraud and abuse</li>
              <li><strong>Legal obligation:</strong> complying with applicable UK law including tax and financial regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Third Party Services</h2>
            <p className="text-muted-foreground">
              Aivia uses the following third party services which may process personal data on our behalf. All are bound by appropriate data processing agreements.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
              <li><strong>Twilio (United States)</strong> — handles all inbound and outbound phone calls, SMS messages, call recordings and caller phone numbers. Twilio is certified under the EU-US Data Privacy Framework.</li>
              <li><strong>OpenAI (United States)</strong> — powers the Aivia AI voice receptionist and processes call transcripts and conversation data in real time. OpenAI is certified under the EU-US Data Privacy Framework.</li>
              <li><strong>ElevenLabs (United States)</strong> — generates the AI voice used by the Aivia receptionist.</li>
              <li><strong>Stripe (United States and United Kingdom)</strong> — processes all payment card data, subscription billing and deposit or booking payments. Stripe is PCI DSS Level 1 certified.</li>
              <li><strong>Resend (United States)</strong> — delivers transactional email notifications to business staff including booking confirmations, account alerts and staff invitations.</li>
              <li><strong>Firecrawl</strong> — used to scrape publicly available information from a business website when a business owner chooses to import their information into Aivia.</li>
              <li><strong>Supabase (European Union, Ireland)</strong> — hosts the Aivia database, file storage and authentication system. All data is stored on EU West servers in Ireland (eu-west-1).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Storage and Retention</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>All Aivia data is stored on EU-based servers in Ireland (Supabase EU West, eu-west-1)</li>
              <li>Business account data is retained for the duration of the subscription plus 90 days after cancellation to allow for data export</li>
              <li>End client booking, reservation and order data is retained for 24 months from the date of the last interaction</li>
              <li>Call recordings are retained for 90 days unless the business requests earlier deletion</li>
              <li>After retention periods expire all data is permanently and securely deleted</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Your Rights Under UK GDPR</h2>
            <p className="text-muted-foreground">You have the following rights regarding your personal data held by Aivia:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Right to access:</strong> request a copy of all personal data we hold about you</li>
              <li><strong>Right to erasure:</strong> request permanent deletion of your personal data</li>
              <li><strong>Right to rectification:</strong> request correction of any inaccurate data</li>
              <li><strong>Right to portability:</strong> request your data in a machine-readable format</li>
              <li><strong>Right to object:</strong> object to processing based on legitimate interests</li>
              <li><strong>Right to restrict processing:</strong> request that we limit how we use your data</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Business owners can exercise the right to erasure and data export directly from their Aivia dashboard under Settings at any time. All other requests should be sent to <strong>privacy@aiviaapp.co.uk</strong>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Security</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>All data is encrypted in transit using HTTPS across aiviaapp.co.uk and all Aivia services</li>
              <li>Row Level Security is enforced on all database tables ensuring each business can only access its own data and never another business's data</li>
              <li>Authentication is required to access any business dashboard or client data</li>
              <li>Leaked password protection is enabled using the Have I Been Pwned database</li>
              <li>Regular security reviews are conducted and any vulnerabilities are remediated promptly</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Cookies</h2>
            <p className="text-muted-foreground">
              Aivia does not use tracking or advertising cookies. We use only essential session cookies required for login and authentication. No cookie consent banner is required as no non-essential cookies are used on aiviaapp.co.uk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Children's Data</h2>
            <p className="text-muted-foreground">
              Aivia is not directed at children under the age of 16. We do not knowingly collect personal data from children. If you believe a child has provided personal data through Aivia please contact <strong>privacy@aiviaapp.co.uk</strong> and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this privacy policy from time to time. When we make material changes we will notify business owners by email and update the Last Updated date at the top of this document. Continued use of Aivia after changes are notified constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact and Complaints</h2>
            <p className="text-muted-foreground">
              For any privacy related queries or to exercise your rights please contact:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: <strong>privacy@aiviaapp.co.uk</strong><br />
              General: <strong>mo@aiviaapp.co.uk</strong><br />
              Website: <a href="https://aiviaapp.co.uk" className="text-primary hover:underline">https://aiviaapp.co.uk</a>
            </p>
            <p className="text-muted-foreground mt-2">
              If you are not satisfied with our response you have the right to lodge a complaint with the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" className="text-primary hover:underline">ico.org.uk</a> or by calling 0303 123 1113.
            </p>
          </section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
};

export default PrivacyPolicy;
