import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseAdmin, getSupabaseUserClient } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = getSupabaseUserClient(authHeader);
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const drops = Math.max(1, Math.min(10, Number(body.drops) || 1));
    const requestedProjectId = body.projectId || null;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: balance, error: balanceError } = await supabaseAdmin
      .from('user_balance')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (balanceError || !balance) {
      return new Response(JSON.stringify({ error: 'User balance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (balance.current_drops < drops) {
      return new Response(JSON.stringify({
        error: `Insufficient water drops: Available ${balance.current_drops}, Required ${drops}`,
        available: balance.current_drops
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --------------------------------------------------------------------------
    // Atomic Compare-And-Swap (CAS) Water Drop Deduction:
    // Deduct drops only if current_drops in database still matches the read value
    // and is >= drops. Concurrent race attempts will update 0 rows and be rejected.
    // --------------------------------------------------------------------------
    const targetDrops = balance.current_drops - drops;
    const { data: casBalance, error: casError } = await supabaseAdmin
      .from('user_balance')
      .update({
        current_drops: targetDrops,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('current_drops', balance.current_drops)
      .gte('current_drops', drops)
      .select()
      .maybeSingle();

    if (casError || !casBalance) {
      return new Response(JSON.stringify({
        error: 'ConcurrencyConflict: Saldo kropel zostało zmienione przez równoległą operację. Spróbuj ponownie.',
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let newCurrentDrops = targetDrops;
    let newActiveTreeDrops = balance.active_tree_drops + drops;

    let newEcoPoints = balance.eco_points + (15 * drops);
    let totalTrees = balance.total_trees_planted;
    let totalCo2 = Number(balance.total_co2_offset_kg);
    let treePlantedNow = false;
    let newTreeData = null;

    if (newActiveTreeDrops >= 10) {
      treePlantedNow = true;
      newActiveTreeDrops = 0;
      totalTrees += 1;
      newEcoPoints += 200; // Bonus points for completing a tree!

      // Fetch active eco project
      let project = null;
      if (requestedProjectId) {
        const { data: pData } = await supabaseAdmin
          .from('eco_projects')
          .select('*')
          .eq('id', requestedProjectId)
          .single();
        project = pData;
      }
      
      if (!project) {
        const { data: pList } = await supabaseAdmin
          .from('eco_projects')
          .select('*')
          .eq('is_active', true)
          .limit(1);
        project = pList?.[0];
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const year = new Date().getFullYear();
      const countryCode = project?.country_code || 'PL';
      const organization = project?.organization || 'Posadzimy.pl';
      const co2Val = Number(project?.co2_absorption_kg_year || 22.00);
      totalCo2 += co2Val;

      const treeNumber = `W4T-${countryCode}-${year}-${randomSuffix}`;
      const certificateNumber = `CERT-${treeNumber}`;

      if (project?.id) {
        const { data: insertedTree, error: treeError } = await supabaseAdmin
          .from('planted_trees')
          .insert({
            user_id: user.id,
            project_id: project.id,
            status: 'CERTIFIED',
            tree_number: treeNumber,
            certificate_number: certificateNumber,
            verified_by: organization,
            pdf_url: `https://watch4trees.org/cert/${certificateNumber}.pdf`,
            latitude: 54.01250,
            longitude: 17.82140,
            planted_at: new Date().toISOString()
          })
          .select('*, project:eco_projects(*)')
          .single();

        if (treeError) {
          console.error('[tree-water] Error inserting planted tree:', treeError);
        } else if (insertedTree) {
          newTreeData = insertedTree;
        }
      }
    }

    // Update user balance in database
    await supabaseAdmin
      .from('user_balance')
      .update({
        current_drops: newCurrentDrops,
        active_tree_drops: newActiveTreeDrops,
        eco_points: newEcoPoints,
        total_trees_planted: totalTrees,
        total_co2_offset_kg: totalCo2,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    // Record ledger transaction
    await supabaseAdmin
      .from('water_drop_transactions')
      .insert({
        user_id: user.id,
        amount: -drops,
        source: 'TREE_CONVERSION',
        metadata: {
          action: 'water_tree',
          drops,
          treePlanted: treePlantedNow,
          treeId: newTreeData?.id || null
        }
      });

    return new Response(JSON.stringify({
      success: true,
      current_drops: newCurrentDrops,
      active_tree_drops: newActiveTreeDrops,
      eco_points: newEcoPoints,
      total_trees_planted: totalTrees,
      total_co2_offset_kg: totalCo2,
      tree_planted_now: treePlantedNow,
      new_tree: newTreeData
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[tree-water] Internal Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
