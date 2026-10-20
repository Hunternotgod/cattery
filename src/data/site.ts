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
  description: '肥猫叉烧的个人作品集：项目、代码仓库、笔记，以及猫、猪和柯基一起住的小房间。',
  tagline: '猫、猪和柯基一起住的个人作品集。',
  giteeUrl: 'https://gitee.com/fat-cat-barbecue',
  email: 'hello@example.com',
  nav: [
    { href: '/', label: '首页' },
    { href: '/projects/', label: '项目' },
    { href: '/notes/', label: '笔记' },
    { href: '/about/', label: '关于' },
  ],
};
