import snapshot from './gitee-contributions.json';

export interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface GiteeContributionSnapshot {
  syncedAt: string | null;
  total: number;
  activeDays: number;
  longestStreak: number;
  days: ContributionDay[];
}

export const GITEE_CONTRIBUTIONS = snapshot as GiteeContributionSnapshot;
