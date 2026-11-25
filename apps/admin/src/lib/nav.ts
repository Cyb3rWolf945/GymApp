export interface NavItem {
  href: string;
  label: string;
  /** The issue that builds the real page, for sections that are still placeholders. */
  comingIn?: string;
}

export const NAV: readonly NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/pnl', label: 'P&L' },
  { href: '/funnel', label: 'Funnel' },
  { href: '/ai-health', label: 'AI health' },
  { href: '/guardrails', label: 'Guardrails' },
  { href: '/users', label: 'Users' },
  { href: '/ads', label: 'Ads', comingIn: 'the ads issue' },
  { href: '/engagement', label: 'Engagement', comingIn: 'the engagement issue' },
  { href: '/content', label: 'Content', comingIn: 'the content issue' },
];
