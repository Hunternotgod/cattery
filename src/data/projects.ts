export const PROJECT_STATUSES = ['active', 'maintained', 'experimental', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; description: string }> = {
  active: { label: '活跃开发', description: '正在持续增加功能和版本' },
  maintained: { label: '维护中', description: '功能稳定，继续修复问题和发布更新' },
  experimental: { label: '实验性', description: '仍在验证方向，接口和行为可能变化' },
  archived: { label: '已归档', description: '停止主要开发，仅保留源码和记录' },
};
