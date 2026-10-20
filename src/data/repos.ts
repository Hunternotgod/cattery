import snapshot from './gitee-repos.json';

export interface RepoSummary {
  name: string;
  fullName: string;
  description: string;
  url: string;
  platform: 'gitee' | 'github';
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
}

export interface RepoSnapshot {
  syncedAt: string | null;
  repos: RepoSummary[];
}

export const REPO_SNAPSHOT = snapshot as RepoSnapshot;

export function formatRepoDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(iso))
    .replaceAll('/', '.');
}
