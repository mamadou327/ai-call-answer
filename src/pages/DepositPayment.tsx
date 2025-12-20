import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";

const setMetaTag = (name: string, content: string) => {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const setCanonical = (href: string) => {
  let el = document.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

const DepositPayment = () => {
  const { bookingCode } = useParams<{ bookingCode: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Pay deposit | Secure Stripe checkout";
    setMetaTag(
      "description",
      "Pay your booking deposit securely via Stripe. Fast checkout and instant confirmation."
    );
    setCanonical(window.location.href);
  }, []);

  useEffect(() => {
    const redirectToPayment = async () => {
      if (!bookingCode) {
        setError("No booking code provided");
        return;
      }

      // Use a public backend function so this works for customers (no login required)
      const { data, error: fnError } = await supabase.functions.invoke(
        "get-deposit-payment-link",
        {
          body: { bookingCode },
        }
      );

      if (fnError) {
        setError(fnError.message || "Payment link is not available");
        return;
      }

      const url = (data as { url?: string; error?: string } | null)?.url;
      const apiError = (data as { error?: string } | null)?.error;

      if (!url) {
        setError(apiError || "Payment link is not available. Please contact the business.");
        return;
      }

      window.location.href = url;
    };

    redirectToPayment();
  }, [bookingCode]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <section className="text-center space-y-4" aria-live="polite">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Pay booking deposit</h1>
          <p className="text-foreground">{error}</p>
          <p className="text-muted-foreground">
            If you need assistance, please contact the business directly.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <section className="text-center space-y-4" aria-busy="true">
        <h1 className="text-xl font-semibold text-foreground">Pay booking deposit</h1>
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Redirecting to secure Stripe checkout…</p>
      </section>
    </main>
  );
};

export default DepositPayment;

