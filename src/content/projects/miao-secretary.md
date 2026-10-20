---
title: "喵秘书"
subtitle: "把群消息整理成一份能看的日报"
summary: "一款 Windows 桌面应用，把 PC 微信群里的通知、待办和关键信息整理成结构化日报。"
role: "独立开发 · 产品设计 · 前端与桌面端"
year: "2024 — 2026"
status: "maintained"
stack:
  - "Tauri 2"
  - "Rust"
  - "React 18"
  - "TypeScript"
  - "Vite"
  - "Tailwind CSS"
  - "IndexedDB / Dexie"
  - "SQLite"
  - "OpenAI 兼容协议"
links:
  repo: "https://gitee.com/fat-cat-barbecue/miao-secretary"
  download: "https://gitee.com/fat-cat-barbecue/miao-secretary/releases/download/v2.2.3/miao-secretary_2.2.3_x64-setup.exe"
screenshots:
  - src: "/projects/miao-secretary/1-v2.webp"
    alt: "喵秘书主界面截图"
    caption: "群列表、同步状态和整理入口"
  - src: "/projects/miao-secretary/2-v2.webp"
    alt: "喵秘书群日报截图"
    caption: "把群聊浓缩成结构化日报"
  - src: "/projects/miao-secretary/3-v2.webp"
    alt: "喵秘书时间线截图"
    caption: "所有整理结果集中回看"
  - src: "/projects/miao-secretary/4-v2.webp"
    alt: "喵秘书设置页截图"
    caption: "AI 服务与同步设置"
cover: "/projects/miao-secretary/tupian.webp"
featured: true
order: 1
draft: false
---

## 群消息不该成为负担

班级群、项目群、活动群、家长群——真正重要的信息往往只有几条，却总是藏在几十条闲聊和表情包之间。等你翻到它的时候，截止时间可能已经过去了。

喵秘书想解决的就是这件事：**让 PC 微信里的群消息变成一份能快速读完的日报。**

## 它怎么工作

喵秘书在 Windows 桌面上运行。它把群消息按群归类，调用你选择的 AI 服务提取重点、待办、时间、地点和链接，再把结果放进统一的时间线。

整理结果不是一段散乱的摘要，而是可以回看、检索和导出的结构。每个群有自己的一份日报，重要的信息会被单独标出来。

## 核心功能

- 自动整理群消息，提取重点、待办和关键信息
- 识别时间、地点、截止日期和链接
- 所有群的整理结果集中查看，可检索、可回看
- 新消息自动同步，也可以手动立即同步
- 支持多家 OpenAI 兼容服务，包括智谱、DeepSeek、MiniMax、Kimi、硅基流动和本地 Ollama
- 诊断报告自动隐藏密钥、Token 和手机号等敏感信息
- 前端异常、同步失败和 AI 调用失败时主动提示导出诊断报告

## 技术架构

桌面壳使用 **Tauri 2**，前端是 **React 18 + TypeScript + Vite + Tailwind CSS**。本地数据通过 **IndexedDB / Dexie** 和 **Tauri SQLite** 插件保存，AI 层使用 OpenAI 兼容协议，方便接入不同服务。

公开仓库包含桌面 UI、AI 服务适配、整理结果、自动同步和设置等部分。PC 微信本地聊天记录的读取通道是闭源组件，仅随官方 Windows 安装包提供；从源码构建时，微信连接会显示不可用，但其余功能不受影响。

## 一个诚实的说明

喵秘书不会上传你的聊天记录。AI 分析只把消息文本发送给你自己配置的 AI 服务；微信数据只在本机读取。

这个项目仍在持续更新。当前稳定版是 **v2.2.3**，下载链接和源码都在下方。
