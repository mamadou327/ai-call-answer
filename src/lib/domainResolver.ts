import { supabase } from "@/integrations/supabase/client";

// List of domains that are considered "main" app domains (not custom domains)
const MAIN_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "aiviaapp.co.uk",
  "www.aiviaapp.co.uk",
  "lovableproject.com",
  "lovable.app",
];

/**
 * Check if the current hostname is a custom domain (not a main app domain)
 */
export function isCustomDomain(hostname: string = window.location.hostname): boolean {
  const normalizedHost = hostname.toLowerCase();
  
  // Check if it's one of the main domains or a subdomain of them
  return !MAIN_DOMAINS.some(domain => {
    return normalizedHost === domain || 
           normalizedHost.endsWith(`.${domain}`) ||
           normalizedHost.includes("lovable"); // Catch all lovable preview domains
  });
}

/**
 * Get the current hostname without port
 */
export function getCurrentHostname(): string {
  return window.location.hostname.toLowerCase();
}

/**
 * Look up a business by its custom domain
 * Returns the business data if found and verified, null otherwise
 */
export async function getBusinessByCustomDomain(customDomain: string): Promise<{
  id: string;
  booking_slug: string;
  business_name: string;
} | null> {
  const normalizedDomain = customDomain.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from("businesses")
    .select("id, booking_slug, business_name, custom_domain_verified")
    .eq("custom_booking_domain", normalizedDomain)
    .eq("custom_domain_verified", true)
    .eq("online_booking_enabled", true)
    .eq("status", "approved")
    .single();

  if (error || !data) {
    console.log(`No verified business found for domain: ${normalizedDomain}`);
    return null;
  }

  return {
    id: data.id,
    booking_slug: data.booking_slug,
    business_name: data.business_name,
  };
}

/**
 * Look up a business by custom domain (even if not verified - for error messaging)
 */
export async function getUnverifiedBusinessByDomain(customDomain: string): Promise<{
  id: string;
  business_name: string;
  custom_domain_verified: boolean;
} | null> {
  const normalizedDomain = customDomain.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from("businesses")
    .select("id, business_name, custom_domain_verified")
    .eq("custom_booking_domain", normalizedDomain)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
