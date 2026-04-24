// Polls Telegram getUpdates for ~55s, dispatches commands
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const tg = (method: string, body: any) =>
  fetch(`${GATEWAY_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

const sendMessage = (chat_id: number, text: string, extra: any = {}) =>
  tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });

const fmt = (n: number) =>
  Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');

async function handleCommand(supabase: any, chatId: number, text: string) {
  const trimmed = text.trim();
  const [cmdRaw, ...args] = trimmed.split(/\s+/);
  const cmd = cmdRaw.toLowerCase().split('@')[0];

  // /start <code> — link account
  if (cmd === '/start') {
    const code = (args[0] || '').toUpperCase();
    if (!code) {
      await sendMessage(chatId, 'Привет! 👋\n\nЧтобы привязать ваш аккаунт Finco, откройте приложение → Настройки → Telegram бот, скопируйте код и отправьте его сюда командой:\n<code>/start ВАШ_КОД</code>');
      return;
    }
    const { data: link } = await supabase
      .from('telegram_links')
      .select('*')
      .eq('link_code', code)
      .maybeSingle();
    if (!link) {
      await sendMessage(chatId, '❌ Код не найден. Сгенерируйте новый код в приложении.');
      return;
    }
    if (link.link_code_expires_at && new Date(link.link_code_expires_at) < new Date()) {
      await sendMessage(chatId, '❌ Код истёк. Сгенерируйте новый код в приложении.');
      return;
    }
    // Check if this chat is already linked to another user
    const { data: existing } = await supabase
      .from('telegram_links')
      .select('user_id')
      .eq('chat_id', chatId)
      .neq('user_id', link.user_id)
      .maybeSingle();
    if (existing) {
      await sendMessage(chatId, '❌ Этот Telegram уже привязан к другому аккаунту. Используйте /unlink сначала.');
      return;
    }
    await supabase
      .from('telegram_links')
      .update({
        chat_id: chatId,
        linked_at: new Date().toISOString(),
        link_code: null,
        link_code_expires_at: null,
      })
      .eq('id', link.id);
    await sendMessage(chatId, '✅ Аккаунт привязан!\n\nДоступные команды:\n/balance — балансы счетов\n/today — операции за сегодня\n/month — отчёт ОПУ за месяц\n/backup — Excel-выгрузка\n/notify on|off — уведомления о новых операциях\n/digest on|off — утренний дайджест\n/unlink — отвязать');
    return;
  }

  // For all other commands, find the linked user
  const { data: link } = await supabase
    .from('telegram_links')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (!link || !link.linked_at) {
    await sendMessage(chatId, 'Аккаунт не привязан. Откройте Finco → Настройки → Telegram бот, чтобы получить код, затем отправьте: <code>/start ВАШ_КОД</code>');
    return;
  }

  const userId = link.user_id;

  if (cmd === '/help' || cmd === '/start') {
    await sendMessage(chatId, '/app — открыть Finco в Telegram\n/balance — балансы\n/today — за сегодня\n/month — отчёт за месяц\n/backup — Excel\n/notify on|off\n/digest on|off\n/unlink');
    return;
  }

  if (cmd === '/app') {
    await sendMessage(chatId, '📱 Откройте Finco прямо в Telegram:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Открыть Finco', web_app: { url: 'https://finco-psg.lovable.app' } },
        ]],
      },
    });
    return;
  }


  if (cmd === '/balance') {
    const { data: accounts } = await supabase.from('accounts').select('name, currency, initial_balance').eq('user_id', userId);
    const { data: txns } = await supabase.from('transactions').select('type, amount, currency, wallet_account, from_account, to_account, target_amount, target_currency').eq('user_id', userId);
    const balances: Record<string, { currency: string; total: number }> = {};
    (accounts || []).forEach((a: any) => {
      balances[a.name] = { currency: a.currency, total: Number(a.initial_balance) };
    });
    (txns || []).forEach((t: any) => {
      const amt = Number(t.amount);
      if (t.type === 'income' && balances[t.wallet_account]) balances[t.wallet_account].total += amt;
      else if ((t.type === 'expense' || t.type === 'dividend') && balances[t.wallet_account]) balances[t.wallet_account].total -= amt;
      else if (t.type === 'transfer') {
        if (balances[t.from_account]) balances[t.from_account].total -= amt;
        if (balances[t.to_account]) {
          const tAmt = t.target_amount != null ? Number(t.target_amount) : amt;
          balances[t.to_account].total += tAmt;
        }
      }
    });
    const lines = Object.entries(balances).map(([name, b]) => `<b>${name}</b>: ${fmt(b.total)} ${b.currency}`);
    await sendMessage(chatId, lines.length ? `💰 <b>Балансы</b>\n\n${lines.join('\n')}` : 'Нет счетов.');
    return;
  }

  if (cmd === '/today') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: txns } = await supabase
      .from('transactions')
      .select('type, amount, currency, cashflow_category, description')
      .eq('user_id', userId)
      .eq('transaction_date', today);
    if (!txns || !txns.length) {
      await sendMessage(chatId, `📅 ${today}\n\nОпераций нет.`);
      return;
    }
    const totals: Record<string, { income: number; expense: number }> = {};
    const lines: string[] = [];
    txns.forEach((t: any) => {
      if (!totals[t.currency]) totals[t.currency] = { income: 0, expense: 0 };
      const amt = Number(t.amount);
      if (t.type === 'income') totals[t.currency].income += amt;
      else if (t.type === 'expense') totals[t.currency].expense += amt;
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↔';
      lines.push(`${sign} ${fmt(amt)} ${t.currency} · ${t.cashflow_category}${t.description ? ` (${t.description})` : ''}`);
    });
    const summary = Object.entries(totals)
      .map(([c, v]) => `${c}: +${fmt(v.income)} / −${fmt(v.expense)} = <b>${fmt(v.income - v.expense)}</b>`)
      .join('\n');
    await sendMessage(chatId, `📅 <b>Сегодня (${today})</b>\n${summary}\n\n${lines.slice(0, 30).join('\n')}${lines.length > 30 ? `\n...и ещё ${lines.length - 30}` : ''}`);
    return;
  }

  if (cmd === '/month') {
    const month = new Date().toISOString().slice(0, 7);
    const { data: txns } = await supabase
      .from('transactions')
      .select('type, amount, currency, cashflow_category')
      .eq('user_id', userId)
      .eq('reporting_month', month);
    const { data: cats } = await supabase
      .from('categories')
      .select('name, type, is_cogs')
      .eq('user_id', userId);
    const cogsSet = new Set((cats || []).filter((c: any) => c.type === 'expense' && c.is_cogs).map((c: any) => c.name));

    const totals: Record<string, { income: number; cogs: number; opex: number }> = {};
    (txns || []).forEach((t: any) => {
      if (!totals[t.currency]) totals[t.currency] = { income: 0, cogs: 0, opex: 0 };
      const amt = Number(t.amount);
      if (t.type === 'income') totals[t.currency].income += amt;
      else if (t.type === 'expense') {
        if (cogsSet.has(t.cashflow_category)) totals[t.currency].cogs += amt;
        else totals[t.currency].opex += amt;
      }
    });
    const lines = Object.entries(totals).map(([c, v]) => {
      const gross = v.income - v.cogs;
      const net = gross - v.opex;
      return `<b>${c}</b>\n  Доход: ${fmt(v.income)}\n  Себестоимость: ${fmt(v.cogs)}\n  Валовая: ${fmt(gross)}\n  Опер. расходы: ${fmt(v.opex)}\n  <b>Чистая: ${fmt(net)}</b>`;
    });
    await sendMessage(chatId, `📊 <b>ОПУ за ${month}</b>\n\n${lines.join('\n\n') || 'Нет данных.'}`);
    return;
  }

  if (cmd === '/backup') {
    await sendMessage(chatId, '⏳ Готовлю Excel...');
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/telegram-backup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, chat_id: chatId }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        await sendMessage(chatId, `❌ Ошибка экспорта: ${t.slice(0, 200)}`);
      }
    } catch (e: any) {
      await sendMessage(chatId, `❌ Ошибка: ${e.message}`);
    }
    return;
  }

  if (cmd === '/notify') {
    const v = (args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') {
      await sendMessage(chatId, 'Использование: <code>/notify on</code> или <code>/notify off</code>');
      return;
    }
    await supabase.from('telegram_links').update({ notify_on_new_tx: v === 'on' }).eq('id', link.id);
    await sendMessage(chatId, `✅ Уведомления о новых операциях: <b>${v === 'on' ? 'включены' : 'выключены'}</b>`);
    return;
  }

  if (cmd === '/digest') {
    const v = (args[0] || '').toLowerCase();
    if (v !== 'on' && v !== 'off') {
      await sendMessage(chatId, 'Использование: <code>/digest on</code> или <code>/digest off</code>');
      return;
    }
    await supabase.from('telegram_links').update({ daily_digest: v === 'on' }).eq('id', link.id);
    await sendMessage(chatId, `✅ Утренний дайджест: <b>${v === 'on' ? 'включён' : 'выключен'}</b>`);
    return;
  }

  if (cmd === '/unlink') {
    await supabase
      .from('telegram_links')
      .update({ chat_id: null, linked_at: null })
      .eq('id', link.id);
    await sendMessage(chatId, '🔌 Аккаунт отвязан. Чтобы привязать снова — сгенерируйте новый код в приложении.');
    return;
  }

  await sendMessage(chatId, 'Неизвестная команда. Отправьте /help для списка команд.');
}

Deno.serve(async () => {
  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let totalProcessed = 0;
  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state').select('update_offset').eq('id', 1).single();
  if (stateErr) return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });

  let currentOffset: number = state.update_offset;

  while (true) {
    const remaining = MAX_RUNTIME_MS - (Date.now() - startTime);
    if (remaining < MIN_REMAINING_MS) break;
    const timeout = Math.min(50, Math.floor(remaining / 1000) - 5);
    if (timeout < 1) break;

    const resp = await tg('getUpdates', { offset: currentOffset, timeout, allowed_updates: ['message'] });
    const data = await resp.json();
    if (!resp.ok) return new Response(JSON.stringify({ error: data }), { status: 502 });

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    const rows = updates.filter((u: any) => u.message).map((u: any) => ({
      update_id: u.update_id,
      chat_id: u.message.chat.id,
      text: u.message.text ?? null,
      raw_update: u,
    }));

    if (rows.length > 0) {
      await supabase.from('telegram_messages').upsert(rows, { onConflict: 'update_id' });
      totalProcessed += rows.length;

      // Process commands
      for (const u of updates) {
        const msg = u.message;
        if (!msg || !msg.text) continue;
        try {
          await handleCommand(supabase, msg.chat.id, msg.text);
        } catch (e: any) {
          console.error('handleCommand error', e);
          try { await sendMessage(msg.chat.id, `⚠️ Ошибка: ${e.message}`); } catch {}
        }
      }
    }

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase.from('telegram_bot_state').update({ update_offset: newOffset, updated_at: new Date().toISOString() }).eq('id', 1);
    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }));
});
