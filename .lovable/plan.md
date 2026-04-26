It looks like a real bug in the Telegram Mini App flow, not expected behavior.

The app currently tries to auto-login from Telegram `initData`, but if the linked account is found it mints a session by generating and immediately verifying a magic link for that user's email. Recent auth logs show `token_revoked` events during token refreshes, which is consistent with the Mini App repeatedly replacing/revoking refresh tokens. That can make Telegram openings fall back to the normal login screen even when the Telegram account is already linked.

Plan:

1. Stabilize Telegram session creation
   - Update the `telegram-webapp-auth` backend function to generate a proper session using the managed auth admin API instead of the current magic-link/verify-OTP workaround.
   - Keep the Telegram HMAC verification exactly as-is so only signed Telegram Mini App launches can log in.
   - Keep the linked-account lookup by Telegram user id.

2. Improve frontend auto-login state handling
   - Make `useTelegramAutoLogin` wait for Telegram WebApp data and avoid permanently giving up if the Telegram SDK is not ready on the first render.
   - Add safer handling for already-restored sessions, failed attempts, and successful `setSession`.
   - Ensure the app stays on the loading state while Telegram auto-login is genuinely in progress, then only shows the password login form if Telegram is not linked or auth fails.

3. Add diagnostic logging without exposing secrets
   - Add minimal backend logs for: initData verified, linked account found/not found, session creation success/failure.
   - This will make it much easier to confirm whether future prompts are caused by “not linked”, invalid Telegram launch data, or auth session creation.

4. Validate the flow
   - Test the `telegram-webapp-auth` function behavior for linked vs. unlinked Telegram users.
   - Confirm the frontend path no longer asks for email/password when opened from Telegram for an already linked account.

No database changes are needed.