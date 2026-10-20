# cattery

一个面向国内读者的 Astro 静态个人博客。

视觉方向见 [DESIGN.md](DESIGN.md)：冷纸色、钴蓝、薄荷，以及一个几何猫眼标记。

## 环境

Node.js >= 22.11（推荐 22.12+ / 22 LTS）。

## 本地运行

```bash
npm install
npm run dev
```

打开 <http://localhost:4321>。

## 构建

```bash
npm run build
npm run preview
```

`npm run build` 会先执行 `astro build`，再用 Pagefind 为 `dist` 生成站内搜索索引。

类型检查：

```bash
npm run check
```

## 写文章

在 `src/content/posts/` 新建 `.md` 文件，frontmatter 格式：

```yaml
---
title: "文章标题"
description: "用于列表和 SEO 的一句话摘要"
pubDate: 2026-10-20
updatedDate: 2026-10-21   # 可选
tags: ["随笔", "建站"]
draft: false              # true 则不会出现在站点、RSS 和 sitemap 中
---
```

## 修改站点信息

- 站点名称、描述：`src/consts.ts`
- 首页文案：`src/pages/index.astro`
- 关于页面：`src/pages/about.astro`
- 样式：`src/styles/global.css`
- 分享卡片：`public/og-default.png`

## 部署到 EdgeOne Pages

1. 把仓库推到 GitHub / GitLab（以 EdgeOne Pages 当前支持的平台为准），并在 EdgeOne Pages 导入项目。
2. Node 版本：22
3. 构建命令：`npm run build`
4. 输出目录：`dist`
5. 环境变量：`SITE_URL=https://你的域名`
6. 绑定自定义域名前，需要完成 ICP 备案。

没有域名时，可以先用 EdgeOne Pages 提供的默认域名预览。

> 部署前务必设置 `SITE_URL`，否则 canonical、RSS、sitemap 和分享卡片里仍然是示例域名。


