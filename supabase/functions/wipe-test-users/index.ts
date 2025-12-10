import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get protected emails from environment variable or use defaults
function getProtectedEmails(): string[] {
  const envEmails = Deno.env.get('PROTECTED_EMAILS');
  if (envEmails) {
    return envEmails.split(',').map(e => e.trim().toLowerCase());
  }
  // Fallback to default protected emails (super admins)
  return [
    "mlaye915@gmail.com",
    "mo@aiviaapp.co.uk"
  ];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header to verify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - no auth header" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is super_admin using the database function
    const { data: isSuperAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: caller.id, _role: 'super_admin' });

    if (roleError || !isSuperAdmin) {
      console.error("Unauthorized access attempt by:", caller.email);
      return new Response(
        JSON.stringify({ error: "Unauthorized - super admin only" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for specific business cleanup
    let requestBody: { businessId?: string; userId?: string } = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch (e) {
      // No body or invalid JSON - proceed with full cleanup
    }

    const PROTECTED_EMAILS = getProtectedEmails();

    // If businessId is provided, do specific business cleanup
    if (requestBody.businessId) {
      console.log(`Starting specific business cleanup for: ${requestBody.businessId}`);
      return await cleanupSpecificBusiness(supabaseAdmin, requestBody.businessId, PROTECTED_EMAILS);
    }

    // If userId is provided, do specific user cleanup
    if (requestBody.userId) {
      console.log(`Starting specific user cleanup for: ${requestBody.userId}`);
      return await cleanupSpecificUser(supabaseAdmin, requestBody.userId, PROTECTED_EMAILS);
    }

    // Otherwise, do full cleanup
    console.log("Starting full test user cleanup by super admin:", caller.email);
    console.log("Protected emails count:", PROTECTED_EMAILS.length);

    // Get all auth users
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    console.log(`Found ${allUsers?.length || 0} total users`);

    // Filter out protected users
    const usersToDelete = allUsers?.filter(
      user => !PROTECTED_EMAILS.includes((user.email || "").toLowerCase())
    ) || [];

    console.log(`Users to delete: ${usersToDelete.length}`);

    let deletedUsers = 0;
    let deletedMemberships = 0;
    let deletedBusinesses = 0;
    let deletedProfiles = 0;
    let deletedRoles = 0;
    const errors: string[] = [];

    // Process each user to delete
    for (const user of usersToDelete) {
      try {
        console.log(`Processing user: ${user.email} (${user.id})`);

        // 1. Delete staff memberships for this user
        const { data: membershipData, error: membershipError } = await supabaseAdmin
          .from("staff_memberships")
          .delete()
          .eq("user_id", user.id)
          .select();
        
        if (membershipError) {
          console.error(`Error deleting memberships for ${user.email}:`, membershipError);
        } else {
          deletedMemberships += membershipData?.length || 0;
        }

        // 2. Delete staff invites for this user's email
        const { error: inviteError } = await supabaseAdmin
          .from("staff_invites")
          .delete()
          .eq("email", user.email || "");
        
        if (inviteError) {
          console.error(`Error deleting invites for ${user.email}:`, inviteError);
        }

        // 3. Delete staff accounts linked to this user
        const { error: staffAccountError } = await supabaseAdmin
          .from("staff_accounts")
          .delete()
          .eq("user_id", user.id);
        
        if (staffAccountError) {
          console.error(`Error deleting staff accounts for ${user.email}:`, staffAccountError);
        }

        // 4. Null out booking user references (keep bookings but remove user associations)
        await supabaseAdmin
          .from("bookings")
          .update({ created_by_user_id: null })
          .eq("created_by_user_id", user.id);

        await supabaseAdmin
          .from("bookings")
          .update({ last_modified_by_user_id: null })
          .eq("last_modified_by_user_id", user.id);

        await supabaseAdmin
          .from("bookings")
          .update({ cancelled_by_user_id: null })
          .eq("cancelled_by_user_id", user.id);

        // 5. Delete businesses owned by this user (and related data)
        const { data: userBusinesses } = await supabaseAdmin
          .from("businesses")
          .select("id")
          .eq("owner_id", user.id);

        if (userBusinesses && userBusinesses.length > 0) {
          for (const business of userBusinesses) {
            await deleteBusinessData(supabaseAdmin, business.id);
            deletedBusinesses++;
          }
        }

        // 6. Delete admin permissions for this user
        await supabaseAdmin
          .from("admin_permissions")
          .delete()
          .eq("user_id", user.id);

        // 7. Delete user roles
        const { data: rolesData, error: rolesError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .select();
        
        if (!rolesError) {
          deletedRoles += rolesData?.length || 0;
        }

        // 8. Delete profile
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("user_id", user.id)
          .select();
        
        if (!profileError) {
          deletedProfiles += profileData?.length || 0;
        }

        // 9. Finally, delete the auth user
        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        if (deleteUserError) {
          console.error(`Error deleting auth user ${user.email}:`, deleteUserError);
          errors.push(`Failed to delete user ${user.email}: ${deleteUserError.message}`);
        } else {
          deletedUsers++;
          console.log(`Successfully deleted user: ${user.email}`);
        }

      } catch (userError: any) {
        console.error(`Error processing user ${user.email}:`, userError);
        errors.push(`Error processing ${user.email}: ${userError.message}`);
      }
    }

    const summary = {
      success: true,
      deletedUsers,
      deletedMemberships,
      deletedBusinesses,
      deletedProfiles,
      deletedRoles,
      protectedUsersCount: PROTECTED_EMAILS.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log("Cleanup complete:", summary);

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to delete all data associated with a business
async function deleteBusinessData(supabaseAdmin: any, businessId: string) {
  console.log(`Deleting data for business: ${businessId}`);
  
  // Delete business-related data first
  await supabaseAdmin.from("call_conversations").delete().eq("business_id", businessId);
  await supabaseAdmin.from("opening_hours").delete().eq("business_id", businessId);
  await supabaseAdmin.from("business_settings").delete().eq("business_id", businessId);
  await supabaseAdmin.from("business_number_selection").delete().eq("business_id", businessId);
  await supabaseAdmin.from("staff_memberships").delete().eq("business_id", businessId);
  await supabaseAdmin.from("staff_invites").delete().eq("business_id", businessId);
  await supabaseAdmin.from("staff_accounts").delete().eq("business_id", businessId);
  await supabaseAdmin.from("staff_time_off").delete().eq("business_id", businessId);
  await supabaseAdmin.from("calls_log").delete().eq("business_id", businessId);
  await supabaseAdmin.from("messages").delete().eq("business_id", businessId);
  await supabaseAdmin.from("customers").delete().eq("business_id", businessId);
  await supabaseAdmin.from("customer_settings").delete().eq("business_id", businessId);
  
  // Delete staff (which may have staff_services)
  const { data: staffData } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("business_id", businessId);
  
  if (staffData) {
    for (const staff of staffData) {
      await supabaseAdmin.from("staff_services").delete().eq("staff_id", staff.id);
    }
  }
  await supabaseAdmin.from("staff").delete().eq("business_id", businessId);
  
  // Delete services
  await supabaseAdmin.from("services").delete().eq("business_id", businessId);
  
  // Delete bookings for this business
  await supabaseAdmin.from("bookings").delete().eq("business_id", businessId);
  
  // Finally delete the business
  const { error: bizError } = await supabaseAdmin
    .from("businesses")
    .delete()
    .eq("id", businessId);
  
  if (bizError) {
    console.error(`Error deleting business ${businessId}:`, bizError);
    throw bizError;
  }
  
  console.log(`Successfully deleted business: ${businessId}`);
}

// Cleanup a specific business and optionally its owner
async function cleanupSpecificBusiness(supabaseAdmin: any, businessId: string, protectedEmails: string[]) {
  const errors: string[] = [];
  let deletedUsers = 0;
  let deletedBusinesses = 0;
  let deletedBookings = 0;
  let deletedStaff = 0;
  let deletedServices = 0;
  let deletedProfiles = 0;
  let deletedRoles = 0;
  let deletedMemberships = 0;

  try {
    // Get business details first
    const { data: business, error: bizError } = await supabaseAdmin
      .from("businesses")
      .select("id, owner_id, business_name")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cleaning up business: ${business.business_name} (${businessId})`);

    // Count items before deletion for summary
    const { count: bookingsCount } = await supabaseAdmin
      .from("bookings")
      .select("*", { count: 'exact', head: true })
      .eq("business_id", businessId);
    
    const { count: staffCount } = await supabaseAdmin
      .from("staff")
      .select("*", { count: 'exact', head: true })
      .eq("business_id", businessId);

    const { count: servicesCount } = await supabaseAdmin
      .from("services")
      .select("*", { count: 'exact', head: true })
      .eq("business_id", businessId);

    const { count: membershipsCount } = await supabaseAdmin
      .from("staff_memberships")
      .select("*", { count: 'exact', head: true })
      .eq("business_id", businessId);

    // Delete the business and all related data
    await deleteBusinessData(supabaseAdmin, businessId);
    deletedBusinesses = 1;
    deletedBookings = bookingsCount || 0;
    deletedStaff = staffCount || 0;
    deletedServices = servicesCount || 0;
    deletedMemberships = membershipsCount || 0;

    // Get owner info
    const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(business.owner_id);
    const ownerEmail = ownerData?.user?.email || "";

    // Delete owner if not protected
    if (!protectedEmails.includes(ownerEmail.toLowerCase())) {
      console.log(`Deleting owner: ${ownerEmail}`);
      
      // Delete owner's profile
      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("user_id", business.owner_id)
        .select();
      deletedProfiles = profileData?.length || 0;

      // Delete owner's roles
      const { data: rolesData } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", business.owner_id)
        .select();
      deletedRoles = rolesData?.length || 0;

      // Delete admin permissions
      await supabaseAdmin
        .from("admin_permissions")
        .delete()
        .eq("user_id", business.owner_id);

      // Delete auth user
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(business.owner_id);
      if (deleteUserError) {
        errors.push(`Failed to delete owner: ${deleteUserError.message}`);
      } else {
        deletedUsers = 1;
      }
    } else {
      console.log(`Owner ${ownerEmail} is protected, not deleting`);
    }

    const summary = {
      success: true,
      deletedBusinesses,
      deletedUsers,
      deletedBookings,
      deletedStaff,
      deletedServices,
      deletedMemberships,
      deletedProfiles,
      deletedRoles,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log("Business cleanup complete:", summary);

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200, 
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error("Business cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Cleanup a specific user (standalone, not a business owner)
async function cleanupSpecificUser(supabaseAdmin: any, userId: string, protectedEmails: string[]) {
  const errors: string[] = [];
  let deletedUsers = 0;
  let deletedProfiles = 0;
  let deletedRoles = 0;
  let deletedMemberships = 0;

  try {
    // Get user info
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
      );
    }

    const userEmail = userData.user.email || "";

    // Check if user is protected
    if (protectedEmails.includes(userEmail.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: "Cannot delete protected user" }),
        { status: 403, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cleaning up user: ${userEmail} (${userId})`);

    // Delete staff memberships
    const { data: membershipsData } = await supabaseAdmin
      .from("staff_memberships")
      .delete()
      .eq("user_id", userId)
      .select();
    deletedMemberships = membershipsData?.length || 0;

    // Delete staff invites for this email
    await supabaseAdmin
      .from("staff_invites")
      .delete()
      .eq("email", userEmail);

    // Delete staff accounts
    await supabaseAdmin
      .from("staff_accounts")
      .delete()
      .eq("user_id", userId);

    // Null out booking references
    await supabaseAdmin
      .from("bookings")
      .update({ created_by_user_id: null })
      .eq("created_by_user_id", userId);

    await supabaseAdmin
      .from("bookings")
      .update({ last_modified_by_user_id: null })
      .eq("last_modified_by_user_id", userId);

    await supabaseAdmin
      .from("bookings")
      .update({ cancelled_by_user_id: null })
      .eq("cancelled_by_user_id", userId);

    // Delete admin permissions
    await supabaseAdmin
      .from("admin_permissions")
      .delete()
      .eq("user_id", userId);

    // Delete user roles
    const { data: rolesData } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .select();
    deletedRoles = rolesData?.length || 0;

    // Delete profile
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", userId)
      .select();
    deletedProfiles = profileData?.length || 0;

    // Delete auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      errors.push(`Failed to delete user: ${deleteUserError.message}`);
    } else {
      deletedUsers = 1;
    }

    const summary = {
      success: true,
      deletedUsers,
      deletedMemberships,
      deletedProfiles,
      deletedRoles,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log("User cleanup complete:", summary);

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200, 
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error("User cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } 
      }
    );
  }
}