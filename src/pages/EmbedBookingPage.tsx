import { lazy, Suspense, useEffect } from "react";

// Reuse the full public booking flow inside an iframe-friendly shell.
const PublicBookingPage = lazy(() => import("./PublicBookingPage"));

const EmbedBookingPage = () => {
  useEffect(() => {
    // Mark body as embedded so global styles can adapt if needed
    document.body.classList.add("aivia-embed");
    return () => {
      document.body.classList.remove("aivia-embed");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        }
      >
        <PublicBookingPage />
      </Suspense>
    </div>
  );
};

export default EmbedBookingPage;
