import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEMO_ACCOUNTS = [
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results = [];

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
