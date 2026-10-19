/**
 * Automated accessibility tests (issue #90).
 *
 * Runs axe-core against the key governance views and fails on any
 * WCAG 2.0/2.1 A or AA violation. Violations are printed with the rule id,
 * impact, offending selectors and a link to the fix guide so CI output is
 * actionable.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor, screen } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import '../i18n';
import ProposalListComponent from '../components/ProposalList';
import VoteHistoryComponent from '../components/VoteHistory';
import ProposalList from '../pages/ProposalList';
import ProposalDetail from '../pages/ProposalDetail';
import VotingPanel from '../pages/VotingPanel';
import { GovernanceDashboard } from '../pages/GovernanceDashboard';
import type { Proposal } from '../types';

const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function formatViolations(violations: axe.Result[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    - ${n.target.join(' ')}\n      fix: ${n.failureSummary?.replace(/\n/g, ' ')}`)
        .join('\n');
      return `[${v.impact}] ${v.id}: ${v.help}\n  guide: ${v.helpUrl}\n${nodes}`;
    })
    .join('\n\n');
}

async function expectNoA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: WCAG_AA_TAGS },
    // jsdom has no layout engine, so colour-contrast cannot be computed here;
    // it is covered by the axe CLI audit against the built app in CI.
    rules: { 'color-contrast': { enabled: false } },
  });
  if (results.violations.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`\nAccessibility violations:\n\n${formatViolations(results.violations)}\n`);
  }
  expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
}

async function check(ui: ReactElement) {
  const { container } = render(<main>{ui}</main>);
  await expectNoA11yViolations(container);
}

const proposals: Proposal[] = [
  {
    id: 'P-001',
    title: 'Alpha Proposal',
    description: 'desc',
    state: 'Active',
    createdAt: '2026-01-01',
    endAt: '2026-04-01',
    votesCount: 1,
    totalWeight: 2000,
    votes: [{ address: 'GCFX4Q...ABC', type: 'For', weight: 2000, votedAt: '2026-02-15' }],
  },
];

describe('accessibility (WCAG 2.1 AA)', () => {
  afterEach(() => cleanup());

  it('ProposalList has no violations', async () => {
    await check(<ProposalListComponent proposals={proposals} />);
  });

  it('ProposalList page has no violations', async () => {
    await check(<ProposalList />);
  });

  it('ProposalDetail has no violations', async () => {
    await check(<ProposalDetail />);
  });

  it('VotingPanel has no violations', async () => {
    await check(<VotingPanel proposalTitle="Alpha Proposal" />);
  });

  it('VoteHistory has no violations', async () => {
    await check(<VoteHistoryComponent proposals={proposals} />);
  });

  it('GovernanceDashboard has no violations', async () => {
    const { container } = render(
      <main>
        <GovernanceDashboard />
      </main>,
    );
    await waitFor(() => expect(screen.getByText(/proposals by state/i)).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
