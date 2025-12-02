import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Protected emails that should NEVER be deleted
const PROTECTED_EMAILS = [
  "mlaye915@gmail.com",
  "cogclt4@gmail.com"
];

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

    // Verify the caller is the super admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is super admin
    if (caller.email !== "mlaye915@gmail.com") {
      console.error("Unauthorized access attempt by:", caller.email);
      return new Response(
        JSON.stringify({ error: "Unauthorized - super admin only" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Starting test user cleanup by super admin:", caller.email);

    // Get all auth users
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    console.log(`Found ${allUsers?.length || 0} total users`);

    // Filter out protected users
    const usersToDelete = allUsers?.filter(
      user => !PROTECTED_EMAILS.includes(user.email || "")
    ) || [];

    console.log(`Users to delete: ${usersToDelete.length}`);
    console.log("Protected emails:", PROTECTED_EMAILS);

    // Get protected user IDs
    const protectedUserIds = allUsers
      ?.filter(user => PROTECTED_EMAILS.includes(user.email || ""))
      .map(user => user.id) || [];

    console.log("Protected user IDs:", protectedUserIds);

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
            // Delete business-related data first
            await supabaseAdmin.from("opening_hours").delete().eq("business_id", business.id);
            await supabaseAdmin.from("services").delete().eq("business_id", business.id);
            await supabaseAdmin.from("business_settings").delete().eq("business_id", business.id);
            await supabaseAdmin.from("business_number_selection").delete().eq("business_id", business.id);
            await supabaseAdmin.from("staff_memberships").delete().eq("business_id", business.id);
            await supabaseAdmin.from("staff_invites").delete().eq("business_id", business.id);
            await supabaseAdmin.from("staff_accounts").delete().eq("business_id", business.id);
            await supabaseAdmin.from("staff_time_off").delete().eq("business_id", business.id);
            await supabaseAdmin.from("calls_log").delete().eq("business_id", business.id);
            
            // Delete staff (which may have staff_services)
            const { data: staffData } = await supabaseAdmin
              .from("staff")
              .select("id")
              .eq("business_id", business.id);
            
            if (staffData) {
              for (const staff of staffData) {
                await supabaseAdmin.from("staff_services").delete().eq("staff_id", staff.id);
              }
            }
            await supabaseAdmin.from("staff").delete().eq("business_id", business.id);
            
            // Delete bookings for this business
            await supabaseAdmin.from("bookings").delete().eq("business_id", business.id);
            
            // Finally delete the business
            const { error: bizError } = await supabaseAdmin
              .from("businesses")
              .delete()
              .eq("id", business.id);
            
            if (!bizError) {
              deletedBusinesses++;
            } else {
              console.error(`Error deleting business ${business.id}:`, bizError);
            }
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
      protectedUsers: PROTECTED_EMAILS,
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
