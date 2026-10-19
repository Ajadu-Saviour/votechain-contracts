// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Governance analytics service (issue #104).
 *
 * Computes the metrics backing GET /api/governance/analytics:
 *
 *   - participation_rate  : unique voters / total token holders, per proposal
 *   - pass_rate           : passed proposals / finalised proposals, rolling 30 days
 *   - avg_quorum_fill_rate : average(total_votes / quorum) across all proposals
 *   - voter_retention     : addresses that voted on > 50% of all proposals
 *
 * In production these are computed from the indexer's `contract_events`
 * table (see indexer/migrations/001_init.sql) — one row per on-chain event,
 * so "created"/"vote"/"final" topics can be joined per proposal_id. This
 * service intentionally mirrors the stub pattern already used by
 * `leaderboardService.ts`: results are cached in Redis and recomputed from
 * the data source on a cache miss. The data-source call
 * (`queryProposalSnapshotsFromIndexer`) is the integration point to replace
 * with a real SQL query against the indexer database.
 */

import type { RedisClientType } from "redis";

type MaybeRedisClient = RedisClientType | null;

const ANALYTICS_CACHE_KEY = "analytics:governance";
// Matches the dashboard's 60-second refresh requirement (issue #104) so a
// cache hit never serves data staler than one refresh cycle.
const CACHE_TTL_SECONDS = 60;
const ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Minimal per-proposal shape needed to compute every metric below. */
export interface ProposalSnapshot {
  id: string;
  quorum: number;
  totalVotes: number;
  uniqueVoters: string[];
  state: "Active" | "Passed" | "Rejected" | "Executed" | "Cancelled";
  finalisedAt: string | null; // ISO timestamp, null while Active
}

export interface GovernanceAnalytics {
  /** Unique voters / total token holders, keyed by proposal id. */
  participation_rate: Record<string, number>;
  /** passed / finalised proposals, over the last 30 days. */
  pass_rate: number;
  /** average(total_votes / quorum) across all proposals. */
  avg_quorum_fill_rate: number;
  /** Addresses that voted on more than 50% of all proposals. */
  voter_retention: string[];
  /** Count of proposals per lifecycle state, powering the "by state" chart. */
  by_state: Record<ProposalSnapshot["state"], number>;
  computed_at: string;
}

/**
 * Data-source integration point.
 *
 * Replace with a real query against the indexer's Postgres database, e.g.
 * joining `contract_events` rows by `proposal_id` for topics
 * "created" / "vote" / "final" to reconstruct each proposal's quorum,
 * total votes, unique voter set, and finalisation state/time.
 *
 * Returns an empty list (yielding zeroed metrics) when no data source is
 * configured, so the dashboard degrades gracefully instead of crashing.
 */
async function queryProposalSnapshotsFromIndexer(): Promise<ProposalSnapshot[]> {
  return [];
}

/** Total number of governance-token holders, used as the participation denominator. */
async function queryTotalTokenHolders(): Promise<number> {
  // In production: SELECT COUNT(DISTINCT holder) FROM token_balances WHERE balance > 0
  return 0;
}

function computeParticipationRate(
  proposals: ProposalSnapshot[],
  totalHolders: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const p of proposals) {
    result[p.id] = totalHolders > 0 ? p.uniqueVoters.length / totalHolders : 0;
  }
  return result;
}

function computePassRate(proposals: ProposalSnapshot[], now: Date): number {
  const cutoff = now.getTime() - ROLLING_WINDOW_MS;
  const finalised = proposals.filter(
    (p) =>
      (p.state === "Passed" || p.state === "Rejected" || p.state === "Executed") &&
      p.finalisedAt !== null &&
      new Date(p.finalisedAt).getTime() >= cutoff
  );
  if (finalised.length === 0) return 0;
  const passed = finalised.filter((p) => p.state === "Passed" || p.state === "Executed");
  return passed.length / finalised.length;
}

function computeAvgQuorumFillRate(proposals: ProposalSnapshot[]): number {
  const withQuorum = proposals.filter((p) => p.quorum > 0);
  if (withQuorum.length === 0) return 0;
  const sum = withQuorum.reduce((acc, p) => acc + p.totalVotes / p.quorum, 0);
  return sum / withQuorum.length;
}

function computeByState(proposals: ProposalSnapshot[]): Record<ProposalSnapshot["state"], number> {
  const counts: Record<ProposalSnapshot["state"], number> = {
    Active: 0,
    Passed: 0,
    Rejected: 0,
    Executed: 0,
    Cancelled: 0,
  };
  for (const p of proposals) {
    counts[p.state] += 1;
  }
  return counts;
}

function computeVoterRetention(proposals: ProposalSnapshot[]): string[] {
  if (proposals.length === 0) return [];
  const voteCounts = new Map<string, number>();
  for (const p of proposals) {
    for (const voter of p.uniqueVoters) {
      voteCounts.set(voter, (voteCounts.get(voter) ?? 0) + 1);
    }
  }
  const threshold = proposals.length / 2;
  return [...voteCounts.entries()]
    .filter(([, count]) => count > threshold)
    .map(([address]) => address)
    .sort();
}

/**
 * Computes (or returns cached) governance analytics.
 * Degrades to zeroed metrics when Redis is unavailable rather than throwing,
 * matching the resilience pattern used elsewhere in the backend (#38).
 */
export async function getGovernanceAnalytics(
  redisClient: MaybeRedisClient
): Promise<GovernanceAnalytics> {
  if (redisClient?.isOpen) {
    const cached = await redisClient.get(ANALYTICS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as GovernanceAnalytics;
    }
  }

  const [proposals, totalHolders] = await Promise.all([
    queryProposalSnapshotsFromIndexer(),
    queryTotalTokenHolders(),
  ]);
  const now = new Date();

  const analytics: GovernanceAnalytics = {
    participation_rate: computeParticipationRate(proposals, totalHolders),
    pass_rate: computePassRate(proposals, now),
    avg_quorum_fill_rate: computeAvgQuorumFillRate(proposals),
    voter_retention: computeVoterRetention(proposals),
    by_state: computeByState(proposals),
    computed_at: now.toISOString(),
  };

  if (redisClient?.isOpen) {
    await redisClient.setEx(ANALYTICS_CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(analytics));
  }

  return analytics;
}

/** Invalidates the analytics cache when new vote/finalise events are indexed. */
export async function invalidateAnalyticsCache(redisClient: MaybeRedisClient): Promise<void> {
  if (!redisClient?.isOpen) return;
  await redisClient.del(ANALYTICS_CACHE_KEY);
}
