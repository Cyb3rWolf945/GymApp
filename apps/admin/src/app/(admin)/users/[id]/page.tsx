import { notFound } from 'next/navigation';
import { PageHeader, Table } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { userDetail } from '@/lib/data';
import { audit, requireAdmin } from '@/lib/session';
import { COMP_TIERS, canComp } from '@/lib/users';
import { adherence, currentPlan, generationHistory, stripeCustomerUrl } from '@/lib/userview';
import { pct } from '@/lib/metrics';
import { deleteUser, grantComp, regeneratePlan, resendMagicLink } from './actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIPE_BASE = process.env.STRIPE_DASHBOARD_URL ?? 'https://dashboard.stripe.com';
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '–');

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; error?: string; contact?: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const flash = await searchParams;
  if (!UUID.test(id)) notFound();

  // Health data is special-category data (GDPR): the audit row is written BEFORE anything is read or shown.
  // If the audit write fails, this page throws and shows nothing.
  await audit({ adminId: admin.id, action: 'view_user_health', target: `user:${id}` });

  const d = await userDetail(id);
  if (!d.user) notFound();

  const plan = currentPlan(d.jobs);
  const history = generationHistory(d.jobs);
  const adh = adherence(d.sessionDates, plan.workout?.days.length ?? 0);
  const ent = d.entitlement;
  const stripeUrl = stripeCustomerUrl(ent?.stripe_customer_id, STRIPE_BASE);
  const p = d.profile ?? {};
  const onboarding = (p.onboarding ?? {}) as Record<string, unknown>;

  const fact = (k: string, v: string) => (
    <Card key={k}>
      <CardTitle>{k}</CardTitle>
      <CardValue className="text-lg">{v}</CardValue>
    </Card>
  );
  const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : 'none');

  return (
    <>
      <PageHeader title="User">{d.user.email ?? d.user.id}. Viewing this page is recorded in the audit log.</PageHeader>
      {flash.done ? <p role="status" className="mb-4 rounded-md border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-300">{flash.done}</p> : null}
      {flash.error ? <p role="alert" className="mb-4 rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">{flash.error}</p> : null}
      {flash.contact && d.user.email ? (
        <p className="mb-4 text-sm text-neutral-300">
          Contact the user: <a className="text-emerald-400 hover:underline" href={`mailto:${d.user.email}`}>{d.user.email}</a>
        </p>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Account</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {fact('Signed up', day(d.user.created_at))}
        {fact('Last sign-in', day(d.user.last_sign_in_at))}
        {fact('Plan', `${ent?.tier ?? 'none'} (${ent?.status ?? 'none'})`)}
        {fact('Plan ends', day(ent?.current_period_end))}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Onboarding profile</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {fact('Name', String(p.display_name ?? '–'))}
        {fact('Sex', String(p.sex ?? '–'))}
        {fact('Birth date', day(p.birth_date as string | null))}
        {fact('Height', p.height_cm ? `${p.height_cm} cm` : '–')}
        {fact('Weight', p.weight_kg ? `${p.weight_kg} kg` : '–')}
        {fact('Goal', String(onboarding.goalType ?? p.goal ?? '–'))}
        {fact('Experience', String(p.experience ?? '–'))}
        {fact('Days per week', String(onboarding.daysPerWeek ?? '–'))}
        {fact('Equipment', list(onboarding.equipment))}
        {fact('Injuries', list(onboarding.contraindications))}
        {fact('Diet', String(onboarding.diet ?? '–'))}
        {fact('Allergies', list(onboarding.allergens))}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Current plan</h2>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Workout plan</CardTitle>
          {plan.workout ? (
            <p className="mt-1 text-sm text-neutral-300">{plan.workout.split}, from {day(plan.workout.at)}: {plan.workout.days.map((x) => `${x.name} (${x.exercises})`).join(', ')}</p>
          ) : <p className="mt-1 text-sm text-neutral-500">No plan yet.</p>}
        </Card>
        <Card>
          <CardTitle>Meal plan</CardTitle>
          {plan.nutrition ? (
            <p className="mt-1 text-sm text-neutral-300">From {day(plan.nutrition.at)}: {plan.nutrition.days.map((x) => `${x.dayType} ${x.kcal} kcal, ${x.meals} meals`).join('; ')}</p>
          ) : <p className="mt-1 text-sm text-neutral-500">No plan yet.</p>}
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Generation history</h2>
      <div className="mb-8">
        <Table
          head={['When', 'Kind', 'Status', 'Made by', 'Attempts', 'QA min', 'QA avg', 'Review']}
          rows={history.map((h) => [day(h.at), h.kind, h.status, h.source, h.attempts, h.qaMin ?? '–', h.qaAvg ?? '–', h.needsReview ? 'needs review' : ''])}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Workouts and adherence</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {fact('Workouts, last 4 weeks', String(adh.done))}
        {fact('Planned', String(adh.planned))}
        {fact('Adherence', pct(adh.rate))}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Payments</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {fact('Source', ent?.source ?? '–')}
        {fact('Price', ent?.price_key ?? '–')}
        {fact('Cancels at period end', ent?.cancel_at_period_end ? 'yes' : 'no')}
        <Card>
          <CardTitle>Stripe</CardTitle>
          {stripeUrl ? <a className="mt-1 block text-emerald-400 hover:underline" href={stripeUrl} target="_blank" rel="noreferrer">Open customer</a> : <p className="mt-1 text-sm text-neutral-500">No Stripe customer.</p>}
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Actions</h2>
      <p className="mb-4 text-sm text-neutral-400">Every action is recorded in the audit log with your name, before it runs.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>Grant a plan</CardTitle>
          {canComp(ent) ? (
            <form action={grantComp} className="space-y-3">
              <input type="hidden" name="userId" value={id} />
              <label className="block text-sm text-neutral-400">Tier
                <select name="tier" defaultValue="pro" className="mt-1 block h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-50">
                  {COMP_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm text-neutral-400">Until (up to 1 year)
                <Input name="endDate" type="date" required />
              </label>
              <Button type="submit" variant="secondary">Grant plan</Button>
            </form>
          ) : <p className="text-sm text-neutral-400">This user has a live Stripe subscription. Change it in Stripe.</p>}
        </Card>

        <Card className="space-y-3">
          <CardTitle>Regenerate plan</CardTitle>
          <p className="text-sm text-neutral-400">Builds a new workout and a new meal plan from the profile. Not limited by the user&apos;s tier.</p>
          <form action={regeneratePlan}><input type="hidden" name="userId" value={id} /><Button type="submit" variant="secondary">Regenerate plan</Button></form>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Resend sign-in link</CardTitle>
          <p className="text-sm text-neutral-400">Sends a new magic link to the user&apos;s own email.</p>
          <form action={resendMagicLink}><input type="hidden" name="userId" value={id} /><Button type="submit" variant="secondary">Send link</Button></form>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Export data</CardTitle>
          <p className="text-sm text-neutral-400">All of the user&apos;s data as a JSON file (a GDPR access request).</p>
          <Button asChild variant="secondary"><a href={`/users/${id}/export`}>Download export</a></Button>
        </Card>

        <Card className="space-y-3 border-red-900 lg:col-span-2">
          <CardTitle>Delete account</CardTitle>
          <p className="text-sm text-neutral-400">Deletes the account and all its data and cancels the Stripe subscription. It cannot be undone. Type the user&apos;s email to confirm.</p>
          <form action={deleteUser} className="flex max-w-xl gap-3">
            <input type="hidden" name="userId" value={id} />
            <Input name="confirm" placeholder={d.user.email ?? d.user.id} autoComplete="off" aria-label="Type the email to confirm" required />
            <Button type="submit" className="bg-red-500 text-neutral-50 hover:bg-red-400">Delete account</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
