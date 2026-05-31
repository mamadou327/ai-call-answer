import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import LegalFooter from "@/components/LegalFooter";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">
          Last updated: 29 May 2025<br />
          These Terms of Service govern your use of the Aivia platform at aiviaapp.co.uk
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <p className="text-muted-foreground">
            Please read these Terms of Service carefully before using Aivia. By creating an account or using any part of the Aivia platform you agree to be bound by these terms. If you do not agree you must not use Aivia.
          </p>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. About Aivia</h2>
            <p className="text-muted-foreground">
              Aivia is an AI-powered business management platform with a built-in AI receptionist, built for service sector businesses including restaurants, salons, barbershops, beauty clinics, healthcare providers, fitness studios, tradespeople and any other business that takes bookings, reservations or customer enquiries. Aivia is developed and operated by Mo Laye trading as Aivia.
            </p>
            <p className="text-muted-foreground mt-2">
              Contact: <strong>mo@aiviaapp.co.uk</strong><br />
              Website: <a href="https://aiviaapp.co.uk" className="text-primary hover:underline">https://aiviaapp.co.uk</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground">By signing up to Aivia you confirm that:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>You are at least 18 years of age</li>
              <li>You are signing up on behalf of a legitimate business and have authority to enter into this agreement on that business's behalf</li>
              <li>Your business is based in the United Kingdom or operates in the United Kingdom</li>
              <li>All information you provide during signup is accurate and complete</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. The Aivia Service</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">3.1 What Aivia provides</h3>
            <p className="text-muted-foreground">
              Subject to these Terms of Service and payment of the applicable subscription fee, Aivia grants you a non-exclusive, non-transferable licence to access and use the following features:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>AI phone receptionist that answers inbound calls to your business, takes bookings, handles enquiries and sends confirmations automatically</li>
              <li>Online booking widget that can be embedded on your business website to accept bookings and reservations</li>
              <li>Business management dashboard including booking calendar, client database and call logs</li>
              <li>SMS and email booking confirmations and reminders sent to your end clients</li>
              <li>Business information import tool</li>
              <li>Data export and account management tools</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              The specific features available to you depend on the subscription plan you have selected. Features may vary between the Starter, Growth and Scale plans.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">3.2 What Aivia does not provide</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Aivia is not a licensed medical, legal or financial service provider</li>
              <li>Aivia does not guarantee that the AI receptionist will handle every call perfectly in every circumstance</li>
              <li>Aivia is not responsible for the accuracy of information you provide about your business services and pricing which the AI uses to answer customer questions</li>
              <li>Aivia does not provide payment processing for your end clients directly. Any payment processing is handled through third party providers and is subject to their separate terms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Subscription and Payment</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">4.1 Plans and pricing</h3>
            <p className="text-muted-foreground">Aivia is offered on the following monthly subscription plans:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Starter:</strong> £149 per month. For solo operators and businesses with up to two staff members</li>
              <li><strong>Growth:</strong> £299 per month. For businesses with up to ten staff members</li>
              <li><strong>Scale:</strong> £499 per month. For larger businesses and groups with up to fifty staff members</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              All prices are quoted exclusive of VAT. VAT will be added at the applicable rate where required.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">4.2 Billing</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Subscriptions are billed monthly in advance on a rolling basis</li>
              <li>Payment is taken automatically on the same date each month via the payment method you provide at signup</li>
              <li>All payments are processed securely through Stripe</li>
              <li>You are responsible for ensuring your payment details remain current and valid</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">4.3 Failed payments</h3>
            <p className="text-muted-foreground">
              If a payment fails Aivia will attempt to collect payment again. If payment remains outstanding after two failed attempts your account may be suspended until payment is received. Aivia reserves the right to terminate accounts with sustained payment failures after reasonable notice.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">4.4 No refunds</h3>
            <p className="text-muted-foreground">
              All subscription fees are non-refundable. If you cancel your subscription mid-month you will retain access to Aivia until the end of the billing period but no partial refund will be issued for unused days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Free Trial</h2>
            <p className="text-muted-foreground">
              Aivia may offer a free trial period to new customers at its discretion. Where a free trial is offered the following conditions apply:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>The free trial period and its terms will be communicated to you at the time of signup</li>
              <li>At the end of the free trial your subscription will automatically convert to a paid plan unless you cancel before the trial ends</li>
              <li>Aivia reserves the right to withdraw or modify free trial offers at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Cancellation</h2>
            <p className="text-muted-foreground">
              You may cancel your Aivia subscription at any time. To cancel you must either use the account deletion feature in your Aivia dashboard under Settings or contact <strong>mo@aiviaapp.co.uk</strong>.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Cancellations take effect at the end of the current billing period</li>
              <li>You will retain access to Aivia until the end of the billing period you have already paid for</li>
              <li>After cancellation your business data will be retained for 90 days to allow you to export it, after which it will be permanently deleted</li>
              <li>Aivia may also cancel or suspend your account immediately if you breach these Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Responsibilities</h2>
            <p className="text-muted-foreground">By using Aivia you agree to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Provide accurate and up to date information about your business, services and pricing so the AI receptionist can answer customer questions correctly</li>
              <li>Keep your account login details secure and not share them with unauthorised individuals</li>
              <li>Ensure you have appropriate consent from your end clients to have their enquiries handled by an AI system where required by applicable law</li>
              <li>Use Aivia only for lawful purposes and in accordance with all applicable UK laws and regulations</li>
              <li>Not use Aivia to harass, deceive or harm any person</li>
              <li>Not attempt to reverse engineer, copy or resell any part of the Aivia platform</li>
              <li>Notify Aivia promptly if you become aware of any unauthorised use of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Acceptable Use</h2>
            <p className="text-muted-foreground">You must not use Aivia for any of the following purposes:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Any illegal or fraudulent activity</li>
              <li>Collecting or processing personal data in a manner that violates UK GDPR or any other applicable data protection law</li>
              <li>Impersonating any person or business</li>
              <li>Sending unsolicited communications or spam through the Aivia platform</li>
              <li>Any activity that could damage, overload or impair the Aivia platform or its infrastructure</li>
              <li>Attempting to gain unauthorised access to any part of the Aivia platform or its systems</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Aivia reserves the right to suspend or terminate any account that violates these acceptable use provisions without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All intellectual property rights in the Aivia platform including its software, design, branding, AI models and documentation are owned by Aivia. Nothing in these Terms of Service transfers any intellectual property rights to you.
            </p>
            <p className="text-muted-foreground mt-2">
              You retain ownership of all business data and content you upload to or create through Aivia. By using Aivia you grant Aivia a limited licence to process and store your data solely for the purpose of providing the Aivia service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Confidentiality</h2>
            <p className="text-muted-foreground">
              Both parties agree to keep confidential any proprietary or sensitive information shared in connection with these Terms of Service and not to disclose it to any third party without prior written consent except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Limitation of Liability</h2>
            <p className="text-muted-foreground">To the maximum extent permitted by applicable law:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Aivia's total liability to you for any claims arising under or in connection with these Terms of Service shall not exceed the total subscription fees paid by you in the three months immediately preceding the claim</li>
              <li>Aivia shall not be liable for any indirect, consequential, incidental or special loss including loss of revenue, loss of profits, loss of business or loss of data even if advised of the possibility of such loss</li>
              <li>Aivia does not exclude liability for death or personal injury caused by negligence, fraud or any other liability that cannot be excluded by law</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              You acknowledge that the AI receptionist is an automated system and may occasionally make errors. Aivia shall not be liable for any loss arising from a missed call, incorrect information provided by the AI receptionist or a booking that was not properly recorded, provided Aivia has taken reasonable steps to ensure the platform functions correctly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">12. Uptime and Service Availability</h2>
            <p className="text-muted-foreground">
              Aivia aims to maintain platform availability of 99% or above measured on a monthly basis. Planned maintenance will be communicated in advance where possible. Aivia is not liable for downtime caused by circumstances outside its reasonable control including third party service outages, internet failures or force majeure events.
            </p>
            <p className="text-muted-foreground mt-2">
              If you experience a service issue please contact <strong>mo@aiviaapp.co.uk</strong> and Aivia will endeavour to respond within one business day.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">13. Changes to the Service and Pricing</h2>
            <p className="text-muted-foreground">
              Aivia reserves the right to modify, add or remove features from the platform at any time. Where changes materially affect your use of the service Aivia will provide reasonable notice.
            </p>
            <p className="text-muted-foreground mt-2">
              Aivia may change its subscription pricing with at least 30 days written notice to existing customers. If you do not accept the new pricing you may cancel your subscription before the new pricing takes effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">14. Changes to These Terms</h2>
            <p className="text-muted-foreground">
              Aivia may update these Terms of Service from time to time. When material changes are made Aivia will notify you by email and update the Last Updated date at the top of this document. Continued use of Aivia after the effective date of changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">15. Governing Law and Disputes</h2>
            <p className="text-muted-foreground">
              These Terms of Service are governed by and construed in accordance with the laws of England and Wales. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
            <p className="text-muted-foreground mt-2">
              Before pursuing formal legal action either party agrees to attempt to resolve any dispute informally by contacting the other party in writing and allowing 30 days for a resolution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">16. Contact</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms of Service please contact:
            </p>
            <p className="text-muted-foreground mt-2">
              Mo Laye<br />
              Trading as Aivia<br />
              Email: <strong>mo@aiviaapp.co.uk</strong><br />
              Website: <a href="https://aiviaapp.co.uk" className="text-primary hover:underline">https://aiviaapp.co.uk</a>
            </p>
            <p className="text-muted-foreground mt-4 italic">
              By creating an Aivia account you confirm you have read, understood and agree to these Terms of Service.
            </p>
          </section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
};

export default TermsOfService;
