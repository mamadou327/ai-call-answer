import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBookings from "./tools/list-bookings";
import listCustomers from "./tools/list-customers";
import listCalls from "./tools/list-calls";
import listServices from "./tools/list-services";
import getBusinessInfo from "./tools/get-business-info";

// The OAuth issuer must be the direct Supabase host, not the .lovable.cloud
// proxy. VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "aivia-mcp",
  title: "Aivia",
  version: "0.1.0",
  instructions:
    "Tools for a business owner using Aivia (AI phone receptionist for salons and restaurants). Read the caller's bookings, customers, recent calls, services, and business profile. All tools act as the signed-in Aivia user and respect per-business isolation.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getBusinessInfo, listBookings, listCustomers, listCalls, listServices],
});
