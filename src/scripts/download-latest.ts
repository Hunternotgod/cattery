const API = 'https://gitee.com/api/v5/repos/fat-cat-barbecue/miao-secretary/releases/latest';
const TIMEOUT_MS = 8000;

interface LatestRelease {
  tag: string;
  url: string;
}

let pending: Promise<LatestRelease> | null = null;

async function fetchLatestRelease(): Promise<LatestRelease> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`release api ${response.status}`);
    const data = await response.json();
    const asset = (data.assets ?? []).find((item: { name?: string }) => /\.exe$/i.test(item.name ?? ''));
    if (!asset?.browser_download_url) throw new Error('no exe asset');
    return { tag: data.tag_name ?? '', url: asset.browser_download_url };
  } finally {
    window.clearTimeout(timer);
  }
}

function getLatestRelease(): Promise<LatestRelease> {
  if (!pending) {
    pending = fetchLatestRelease().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

function setStatus(link: HTMLAnchorElement, text: string) {
  const control = link.closest('.download-control');
  const status = control?.querySelector<HTMLElement>('[data-download-status]');
  if (status) status.textContent = text;
}

function setLabel(link: HTMLAnchorElement, text: string) {
  const label = link.querySelector<HTMLElement>('[data-download-label]');
  if (label) label.textContent = text;
}

async function init() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-miao-download]')];
  if (links.length === 0) return;

  for (const link of links) {
    link.addEventListener('click', async (event) => {
      if (link.dataset.ready === 'true') return;
      event.preventDefault();
      if (link.dataset.busy === 'true') return;
      link.dataset.busy = 'true';
      link.setAttribute('aria-busy', 'true');
      setLabel(link, '正在获取最新版…');
      setStatus(link, '正在检查 Gitee 最新版本');

      try {
        const latest = await getLatestRelease();
        link.href = latest.url;
        link.dataset.ready = 'true';
        link.dataset.busy = 'false';
        link.removeAttribute('aria-busy');
        setLabel(link, `下载 Windows 版 ${latest.tag}`);
        setStatus(link, `已获取 ${latest.tag}`);
        window.location.assign(latest.url);
      } catch {
        const fallback = link.dataset.fallbackDownload || link.dataset.releasePage || '';
        link.dataset.busy = 'false';
        link.removeAttribute('aria-busy');
        setLabel(link, '下载上次同步版本');
        setStatus(link, '最新版本检查失败，使用上次同步的安装包');
        if (fallback) window.location.assign(fallback);
      }
    });
  }

  try {
    const latest = await getLatestRelease();
    for (const link of links) {
      link.href = latest.url;
      link.dataset.ready = 'true';
      setLabel(link, `下载 Windows 版 ${latest.tag}`);
      setStatus(link, `最新版本 ${latest.tag}`);
    }
  } catch {
    for (const link of links) {
      setLabel(link, '下载上次同步版本');
      setStatus(link, '暂时无法检查最新版，已使用同步安装包');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
