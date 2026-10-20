export interface SiteConfig {
  title: string;
  author: string;
  description: string;
  tagline: string;
  giteeUrl: string;
  email: string;
  nav: ReadonlyArray<{ href: string; label: string }>;
}

export const SITE: SiteConfig = {
  title: 'cattery',
  author: '肥猫叉烧',
  description: '肥猫叉烧的个人作品集：项目、代码仓库、笔记，以及猫、猪和柯基一起住的赛博电竞房。',
  tagline: '猫、猪、柯基，和一个写代码的人。',
  giteeUrl: 'https://gitee.com/fat-cat-barbecue',
  email: 'hello@example.com',
  nav: [
    { href: '/', label: '首页' },
    { href: '/projects/', label: '项目' },
    { href: '/notes/', label: '笔记' },
    { href: '/about/', label: '关于' },
  ],
};

