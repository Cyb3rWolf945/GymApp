// Legal pages. These are TEMPLATES, clearly marked for legal review: they must be replaced by text a lawyer has
// approved before launch. Bump the version of a document when its text changes materially; users then give
// consent again for the new version.

export const LEGAL_KINDS = ['terms', 'privacy', 'health'] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

/** Current version of each document. Stored with every consent record. */
export const LEGAL_VERSIONS: Record<LegalKind, string> = {
  terms: '2026-11-25-draft',
  privacy: '2026-11-25-draft',
  health: '2026-11-25-draft',
};

export const REVIEW_NOTICE = 'Template for legal review. Not legal advice and not yet approved. Do not launch with this text.';

export interface LegalSection {
  heading: string;
  body: string;
}
export interface LegalDoc {
  kind: LegalKind;
  title: string;
  version: string;
  reviewNotice: string;
  sections: LegalSection[];
}

const doc = (kind: LegalKind, title: string, sections: LegalSection[]): LegalDoc => ({ kind, title, version: LEGAL_VERSIONS[kind], reviewNotice: REVIEW_NOTICE, sections });

export const LEGAL_DOCS: Record<LegalKind, LegalDoc> = {
  terms: doc('terms', 'Terms of use', [
    { heading: 'Who we are', body: 'Fuelift is a training and nutrition app. [Company name, address and registration number go here.]' },
    { heading: 'Your account', body: 'You need an account to save your plans. Keep your sign-in details safe. You must be at least 16 years old to use Fuelift.' },
    { heading: 'Plans and subscriptions', body: 'Some features need a paid plan. Subscriptions renew until you cancel. You can cancel at any time in the customer portal, and your plan stays active until the end of the period you paid for. [Refund and withdrawal terms go here.]' },
    { heading: 'Fair use', body: 'Plan generation has monthly limits to keep the service fast for everyone. Do not misuse the service or try to break it.' },
    { heading: 'Your content', body: 'Your workouts, measurements and notes belong to you. You allow us to process them to run the service.' },
    { heading: 'Changes and ending', body: 'We may change these terms. We will tell you about important changes. You can delete your account in Settings at any time.' },
    { heading: 'Liability and law', body: '[Liability limits, governing law and dispute resolution go here.]' },
  ]),
  privacy: doc('privacy', 'Privacy policy', [
    { heading: 'What we collect', body: 'Your account details, the answers you give in the quiz (goal, body measurements, injuries, diet and allergies), your workouts and weight, and basic usage events. Payments are handled by Stripe; we never see your card number.' },
    { heading: 'Health data', body: 'Information about your body, injuries, diet and allergies is health data, a special category under the GDPR. We only process it with your explicit consent, to build and adjust your plan. You can withdraw consent by deleting your account.' },
    { heading: 'How we use it', body: 'To build your plans, track your progress, run subscriptions and keep the service safe. Plans are generated with AI providers. We send them only the information needed for your plan and never your name or email.' },
    { heading: 'Who receives it', body: 'Our hosting and database provider (Supabase), our payment provider (Stripe) and our AI providers (through OpenRouter). [Full list of processors and transfer safeguards goes here.]' },
    { heading: 'How long we keep it', body: 'Until you delete your account. Free-text safety logs are removed after 30 days. Payment records are kept as long as the law requires.' },
    { heading: 'Your rights', body: 'You can access and download your data (Settings, Export my data), correct it, and delete your account and all your data (Settings, Delete account). You can also complain to your data protection authority. [Controller contact and DPO details go here.]' },
  ]),
  health: doc('health', 'Health disclaimer', [
    { heading: 'Not medical advice', body: "Fuelift gives general fitness and nutrition guidance. It isn't medical advice and it doesn't replace a doctor, physiotherapist or registered dietitian." },
    { heading: 'Talk to a professional first', body: 'Check with a doctor before you start if you are pregnant, have an injury, a medical condition, an eating disorder or take medication.' },
    { heading: 'Listen to your body', body: 'Stop and get medical help if you feel pain, dizziness or unwell. You train and eat at your own risk.' },
    { heading: 'Allergies', body: 'We avoid the allergens you tell us about, but recipes and ingredients can change. Always check labels yourself.' },
  ]),
};

/** Documents in the order users see them in links. */
export const legalDoc = (kind: string): LegalDoc | null => (LEGAL_KINDS as readonly string[]).includes(kind) ? LEGAL_DOCS[kind as LegalKind] : null;
