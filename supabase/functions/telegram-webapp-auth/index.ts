// Verifies Telegram WebApp initData and returns a Supabase session for the linked user.
// If the Telegram user has no linked Finco account yet, returns { linked: false }.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';

function log(...args: unknown[]) {
  console.log('[telegram-webapp-auth]', ...args);
}

// initData is signed with HMAC-SHA256 using key = HMAC-SHA256("WebAppData", bot_token)
async function verifyInitData(initData: string, botToken: string): Promise<Record<string, string> | null> {
  if (!botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const enc = new TextEncoder();
  const secretKeyRaw = await crypto.subtle.importKey(
    'raw', enc.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const secretKey = await crypto.subtle.sign('HMAC', secretKeyRaw, enc.encode(botToken));
  const hmacKey = await crypto.subtle.importKey(
    'raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (computed !== hash) {
    log('hash mismatch');
    return null;
  }

  // Freshness check: 24h
  const authDate = Number(params.get('auth_date') || '0');
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    log('initData expired or missing auth_date', { authDate });
    return null;
  }

  return Object.fromEntries(params.entries());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { initData } = await req.json().catch(() => ({}));
    if (!initData || typeof initData !== 'string') {
      log('missing initData');
      return new Response(JSON.stringify({ error: 'Missing initData' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      log('TELEGRAM_BOT_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verified = await verifyInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!verified) {
      return new Response(JSON.stringify({ error: 'Invalid or expired initData' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userJson = verified.user;
    if (!userJson) {
      log('no user in initData');
      return new Response(JSON.stringify({ error: 'No user in initData' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const tgUser = JSON.parse(userJson);
    const tgUserId: number = tgUser.id;
    log('verified initData for tg user', tgUserId);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up linked Finco user by chat_id (= Telegram user id for private chats)
    const { data: link, error: linkLookupErr } = await admin
      .from('telegram_links')
      .select('user_id')
      .eq('chat_id', tgUserId)
      .not('linked_at', 'is', null)
      .maybeSingle();

    if (linkLookupErr) log('link lookup error', linkLookupErr.message);

    if (!link) {
      log('no linked account for tg user', tgUserId);
      return new Response(JSON.stringify({
        linked: false,
        telegram_user: { id: tgUserId, first_name: tgUser.first_name, username: tgUser.username },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    log('linked account found', { user_id: link.user_id });

    // Get the user's email
    const { data: userInfo, error: userErr } = await admin.auth.admin.getUserById(link.user_id);
    if (userErr || !userInfo?.user?.email) {
      log('linked user not found', userErr?.message);
      return new Response(JSON.stringify({ error: 'Linked user not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const email = userInfo.user.email;

    // Generate a magic link, then verify the OTP server-side to mint a real session.
    // Using `magiclink` returns a token_hash (hashed_token) we can verify with verifyOtp.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData?.properties) {
      log('generateLink failed', linkErr?.message);
      return new Response(JSON.stringify({ error: linkErr?.message || 'Failed to create session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const props = linkData.properties as { hashed_token?: string; email_otp?: string };
    const hashed = props.hashed_token;
    if (!hashed) {
      log('no hashed_token in generateLink response');
      return new Response(JSON.stringify({ error: 'Failed to create session token' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use a fresh anon client for verifyOtp so we don't pollute the admin client's session.
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sess, error: vErr } = await anon.auth.verifyOtp({
      type: 'magiclink',
      token_hash: hashed,
    });
    if (vErr || !sess?.session) {
      log('verifyOtp failed', vErr?.message);
      return new Response(JSON.stringify({ error: vErr?.message || 'Failed to verify session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log('session minted for user', link.user_id);
    return new Response(JSON.stringify({
      linked: true,
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    log('unhandled error', e?.message);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
