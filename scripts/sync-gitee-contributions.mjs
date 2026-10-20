import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const owner = 'fat-cat-barbecue';
const target = 'src/data/gitee-contributions.json';
const source = `https://gitee.com/${owner}`;

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}=['"]([^'"]*)['"]`, 'i'));
  return match?.[1] ?? null;
}

function levelForCount(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function calculateLongestStreak(days) {
  let longest = 0;
  let current = 0;
  for (const day of days) {
    current = day.count > 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

try {
  const response = await fetch(source, {
    headers: {
      'User-Agent': 'cattery-site contribution snapshot',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Gitee profile returned ${response.status}`);
  const html = await response.text();
  const cells = [...html.matchAll(/<div\b([^>]*\bclass=['"][^'"]*\bbox\b[^'"]*['"][^>]*)>/gi)]
    .map((match) => {
      const tag = match[1];
      const date = attribute(tag, 'date');
      const content = attribute(tag, 'data-content');
      const countMatch = content?.match(/(\d+)\s*个贡献/);
      if (!date || !countMatch) return null;
      const normalized = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
      return {
        date: normalized,
        count: Number(countMatch[1]),
        level: levelForCount(Number(countMatch[1])),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (cells.length < 300) {
    throw new Error(`Expected at least 300 contribution days, found ${cells.length}`);
  }

  const days = cells.slice(-365);
  const snapshot = {
    syncedAt: new Date().toISOString(),
    total: days.reduce((sum, day) => sum + day.count, 0),
    activeDays: days.filter((day) => day.count > 0).length,
    longestStreak: calculateLongestStreak(days),
    days,
  };
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Synced ${days.length} contribution days (${snapshot.total} contributions)`);
} catch (error) {
  let previous = null;
  if (existsSync(target)) {
    try {
      previous = JSON.parse(await readFile(target, 'utf8'));
    } catch {}
  }
  if (previous?.days?.length) {
    console.warn(`Gitee contribution sync failed; keeping existing snapshot. ${error.message}`);
  } else {
    const empty = { syncedAt: null, total: 0, activeDays: 0, longestStreak: 0, days: [] };
    await writeFile(target, `${JSON.stringify(empty, null, 2)}\n`, 'utf8');
    console.warn(`Gitee contribution sync failed; wrote empty snapshot. ${error.message}`);
  }
}
