# NAMA organization subscriptions and Telegram administration

## Subscription model

- One subscription belongs to one organization.
- Consultant seats are unlimited. There is no seat counter or per-consultant billing tier.
- The subscription's status and expiry gate every organization member's login and data access.
- Each consultant has a unique username and password.
- The public registration route is removed from the mobile app. Accounts are provisioned by the private Telegram admin bot.

## Database deployment

Apply the migration in `supabase/migrations/20261114131452_nama_organizations_unlimited_subscriptions.sql` to the NAMA Supabase project before deploying the functions. It creates organizations, subscriptions, profiles, memberships, organization-aware property access, and organization-scoped media policies.

The migration assumes the existing NAMA `properties`, `hotspots`, and `property-media` bucket already exist.

## Edge Function deployment

Deploy from the repository root using the Supabase CLI:

```bash
supabase link --project-ref laezrjnznyjqfibpczfz
supabase db push --remote --yes
supabase functions deploy username-login
supabase functions deploy telegram-admin
```

Set these function secrets in the Supabase project (never put them in the app or Git):

```bash
supabase secrets set TELEGRAM_BOT_TOKEN="BOT_TOKEN_FROM_BOTFATHER"
supabase secrets set TELEGRAM_ADMIN_IDS="YOUR_NUMERIC_TELEGRAM_USER_ID"
supabase secrets set TELEGRAM_WEBHOOK_SECRET="A_LONG_RANDOM_SECRET"
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the legacy `SUPABASE_SERVICE_ROLE_KEY` environment variable to Edge Functions on this existing project. The service-role key is only used inside server-side functions and must never be added to GitHub or the mobile app.

## Telegram webhook

Create a bot with BotFather, then set its webhook to the deployed function URL. Use the same secret value configured above:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://laezrjnznyjqfibpczfz.supabase.co/functions/v1/telegram-admin" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

The bot only accepts private messages from numeric Telegram IDs in `TELEGRAM_ADMIN_IDS`.

## Bot commands

Use underscores in the organization name if it contains spaces.

- `/neworg Organization_Name manager_username Manager_Full_Name` — creates an organization, a pending subscription, and its owner account.
- `/adduser ORGANIZATION_UUID username Full_Name` — creates another consultant. There is no consultant limit.
- `/renew ORGANIZATION_UUID DAYS` — activates or extends the organization subscription.
- `/suspend username` / `/activate username` — suspends or reactivates one member.
- `/suspendorg ORGANIZATION_UUID` / `/activateorg ORGANIZATION_UUID` — controls the whole organization.
- `/orgs` — lists organizations and subscription status.
- `/help` — shows command help.

The bot returns a generated initial password after creating a user. Deliver it privately to that user and do not publish it in a group.

## Important production setting

In Supabase Dashboard → Authentication → Sign In / Providers, disable public user signups. The mobile app no longer exposes registration; the bot creates accounts through the server-side Admin API.

## Before production

1. Apply the migration and deploy both Edge Functions.
2. Configure the bot secrets and webhook.
3. Disable public signups.
4. Test a new organization, an unlimited number of consultant accounts, renewal, individual suspension, organization suspension, and expiry.
5. Configure a permanent Android release keystore in GitHub Actions before distributing production APKs.
