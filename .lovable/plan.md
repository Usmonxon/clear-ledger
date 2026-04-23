

## Plan: Telegram bot for updates and backups

A Telegram bot that lets each user (1) link their Telegram account to their Finco account, (2) receive daily/weekly summaries and real-time transaction notifications, and (3) request an Excel backup on demand.

### Security note about the token
You pasted the bot token in chat. **Treat it as compromised** — anyone in this conversation history could use it. After setup, open BotFather → `/revoke` → get a fresh token, and give the new one to Lovable via the secure secret prompt (never paste tokens in chat again). I'll use the Telegram **connector** so the token is stored securely server-side, not in code.

### Architecture

```text
Finco user ──/start ABC123──▶ Telegram Bot
                                   │
                                   ▼
                         Edge function: telegram-poll  (cron: every minute, long-poll 55s)
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
    link chat_id to user      handle commands     store messages
              │              (/balance /backup     
              ▼               /today /month)
       telegram_links              │
                                   ▼
                         Edge function: telegram-send
                                   ▲
                                   │
              ┌────────────────────┴────────────────────┐
       Daily digest cron                       Realtime trigger
       (08:00 every day)                       (on new transaction)
```

### Database

New tables (RLS on, owner-only):

- `telegram_links` — `user_id`, `chat_id`, `link_code`, `linked_at`, `notify_on_new_tx` (bool), `daily_digest` (bool)
- `telegram_bot_state` — singleton `update_offset` (service-role only, for getUpdates polling)
- `telegram_messages` — incoming raw updates for debugging (auto-cleanup after 7 days)

### Edge functions

1. **`telegram-poll`** — runs every minute via pg_cron, long-polls `getUpdates` for ~55s, dispatches commands.
2. **`telegram-send`** — internal helper used by other functions to send messages via the gateway.
3. **`telegram-daily-digest`** — runs every morning, sends each linked user yesterday's income/expense summary.
4. **`telegram-on-transaction`** — triggered by realtime/webhook on `transactions` insert; sends notification if `notify_on_new_tx` is on.
5. **`telegram-backup`** — generates the same Excel export the app produces (reusing logic from `src/lib/exportExcel.ts` adapted for Deno + service role) and sends it as a document to the requesting chat.

### Bot commands

- `/start <code>` — link Telegram chat to Finco user using a one-time 6-char code generated in Settings
- `/balance` — current balances per account/currency
- `/today` — today's transactions and totals
- `/month` — this month's PnL summary (income, COGS, opex, net)
- `/backup` — sends the full Excel export file
- `/notify on|off` — toggles real-time new-transaction notifications
- `/digest on|off` — toggles morning digest
- `/unlink` — removes the link

### UI changes

**`src/pages/Settings.tsx`** — new "Telegram бот" tab/section:
- "Подключить Telegram" button → generates a fresh `link_code` and shows: `Откройте @YourBotName и отправьте: /start ABC123` (with a one-tap deep link `https://t.me/<bot>?start=ABC123`)
- Once linked: shows linked chat info + toggles for "Уведомлять о новых операциях" and "Утренний дайджест" + "Отвязать" button

### Setup steps (in order)

1. **Revoke the leaked token** in BotFather, get a new one.
2. Lovable enables the Telegram connector → you paste the new token into the secure prompt.
3. Lovable creates DB tables, deploys the 5 edge functions, schedules cron jobs (poll every minute, digest at 08:00).
4. Lovable adds the Telegram section to Settings.
5. You test: open Settings → Connect → click the t.me link → send `/start <code>` → try `/balance`, `/backup`.

### Out of scope (for now)
- Multi-language replies (Russian only, matching the app)
- Charts in Telegram (text + Excel only)
- Group chat support (1:1 chats only)
- Per-account notification filters

