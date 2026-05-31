import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEMO_ACCOUNTS = [
  {
    email: 'Bonata@aiviaapp.co.uk',
    password: 'Bonata123',
    businessName: 'Bonata Restaurant',
    businessType: 'restaurant_hybrid',
    address: '1 Demo Street, London, W1A 1AA',
    phone: '+44 20 1234 5678',
  },
  {
    email: 'demo-salon@aivia.app',
    password: 'AiviaDemo2024!',
    businessName: 'Luxe Hair Studio',
    businessType: 'salon',
    address: '123 High Street, London, W1A 1AA',
    phone: '+44 20 7123 4567',
  },
  {
    email: 'demo-pickup@aivia.app',
    password: 'AiviaDemo2024!',
    businessName: 'Fresh Bites Takeaway',
    businessType: 'restaurant_pickup',
    address: '45 Market Lane, Manchester, M1 2AB',
    phone: '+44 161 234 5678',
  },
  {
    email: 'demo-dinein@aivia.app',
    password: 'AiviaDemo2024!',
    businessName: 'The Golden Table',
    businessType: 'restaurant_dine_in',
    address: '78 Royal Parade, Birmingham, B1 3CD',
    phone: '+44 121 345 6789',
  },
  {
    email: 'demo-hybrid@aivia.app',
    password: 'AiviaDemo2024!',
    businessName: "Bella's Kitchen",
    businessType: 'restaurant_hybrid',
    address: '92 Victoria Road, Leeds, LS1 4EF',
    phone: '+44 113 456 7890',
  },
];

// Staff demo accounts - linked to existing businesses by ID
const STAFF_DEMO_ACCOUNTS = [
  {
    email: 'staffbonata@aiviaapp.co.uk',
    password: 'Bonata123',
    firstName: 'Demo',
    lastName: 'Staff',
    businessId: '90cd1faf-875e-4cce-ab54-d013cf45ae31', // Bonata (Paddington)
    position: 'Server',
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require super_admin caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: isSuperAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: claimsData.claims.sub,
      _role: 'super_admin',
    });
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    // Create business owner accounts
    for (const account of DEMO_ACCOUNTS) {
      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === account.email);

        let userId: string;

        if (existingUser) {
          userId = existingUser.id;
          results.push({ email: account.email, status: 'already exists', userId });
        } else {
          // Create auth user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true,
          });

          if (authError) {
            results.push({ email: account.email, status: 'auth error', error: authError.message });
            continue;
          }

          userId = authData.user.id;
          results.push({ email: account.email, status: 'created', userId });
        }

        // Check if business already exists for this user
        const { data: existingBusiness } = await supabaseAdmin
          .from('businesses')
          .select('id')
          .eq('owner_id', userId)
          .single();

        if (!existingBusiness) {
          // Create business
          const { error: businessError } = await supabaseAdmin
            .from('businesses')
            .insert({
              owner_id: userId,
              business_name: account.businessName,
              business_type: account.businessType,
              address: account.address,
              main_phone: account.phone,
              status: 'approved',
              aivia_active: true,
              online_booking_enabled: true,
            });

          if (businessError) {
            results.push({ email: account.email, businessStatus: 'error', error: businessError.message });
          } else {
            results.push({ email: account.email, businessStatus: 'created' });
          }
        } else {
          results.push({ email: account.email, businessStatus: 'already exists' });
        }

        // Check if user_roles entry exists
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!existingRole) {
          // Add business_owner role
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: userId,
              role: 'business_owner',
            });

          if (roleError) {
            results.push({ email: account.email, roleStatus: 'error', error: roleError.message });
          } else {
            results.push({ email: account.email, roleStatus: 'created' });
          }
        }
      } catch (err) {
        results.push({ email: account.email, status: 'exception', error: String(err) });
      }
    }

    // Create staff demo accounts
    for (const staffAccount of STAFF_DEMO_ACCOUNTS) {
      try {
        // Use the business ID directly
        const businessId = staffAccount.businessId;

        // Check if staff user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        let staffUserId: string;
        const existingStaffUser = existingUsers?.users?.find(u => u.email === staffAccount.email);

        if (existingStaffUser) {
          staffUserId = existingStaffUser.id;
          results.push({ email: staffAccount.email, status: 'already exists', userId: staffUserId });
        } else {
          // Create staff auth user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: staffAccount.email,
            password: staffAccount.password,
            email_confirm: true,
          });

          if (authError) {
            results.push({ email: staffAccount.email, status: 'auth error', error: authError.message });
            continue;
          }

          staffUserId = authData.user.id;
          results.push({ email: staffAccount.email, status: 'created', userId: staffUserId });
        }

        // Check if staff membership already exists
        const { data: existingMembership } = await supabaseAdmin
          .from('staff_memberships')
          .select('id')
          .eq('user_id', staffUserId)
          .eq('business_id', businessId)
          .single();

        if (!existingMembership) {
          // Create staff membership
          const { error: membershipError } = await supabaseAdmin
            .from('staff_memberships')
            .insert({
              user_id: staffUserId,
              business_id: businessId,
              first_name: staffAccount.firstName,
              last_name: staffAccount.lastName,
              position: staffAccount.position,
              status: 'active',
              role: 'staff',
              approved_at: new Date().toISOString(),
            });

          if (membershipError) {
            results.push({ email: staffAccount.email, membershipStatus: 'error', error: membershipError.message });
          } else {
            results.push({ email: staffAccount.email, membershipStatus: 'created' });
          }
        } else {
          results.push({ email: staffAccount.email, membershipStatus: 'already exists' });
        }

        // Add staff role
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', staffUserId)
          .eq('role', 'staff')
          .single();

        if (!existingRole) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: staffUserId,
              role: 'staff',
            });

          if (roleError) {
            results.push({ email: staffAccount.email, roleStatus: 'error', error: roleError.message });
          } else {
            results.push({ email: staffAccount.email, roleStatus: 'created' });
          }
        }
      } catch (err) {
        results.push({ email: staffAccount.email, status: 'exception', error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});