import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eagerly load landing page for best LCP
import Index from "./pages/Index";

// Lazy load all other routes to reduce initial bundle size
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const StaffInvite = lazy(() => import("./pages/StaffInvite"));
const StaffLogin = lazy(() => import("./pages/StaffLogin"));
const StaffPendingApproval = lazy(() => import("./pages/StaffPendingApproval"));
const StaffDashboard = lazy(() => import("./pages/StaffDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminRegister = lazy(() => import("./pages/AdminRegister"));
const AdminPending = lazy(() => import("./pages/AdminPending"));

const StripeConnectCallback = lazy(() => import("./pages/StripeConnectCallback"));
const DepositPayment = lazy(() => import("./pages/DepositPayment"));
const PublicBookingPage = lazy(() => import("./pages/PublicBookingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/staff/invite" element={<StaffInvite />} />
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff/pending" element={<StaffPendingApproval />} />
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<AdminRegister />} />
            <Route path="/admin/pending" element={<AdminPending />} />
            <Route path="/stripe-connect-callback" element={<StripeConnectCallback />} />
            <Route path="/pay/:bookingCode" element={<DepositPayment />} />
            <Route path="/book/:slug" element={<PublicBookingPage />} />
            <Route path="/book/:slug/success" element={<PublicBookingPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
