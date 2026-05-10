# 项目经验沉淀文档分层设计

日期：2026-05-09

## 1. 背景

项目保存/打开功能完成后，执行过程沉淀出了一组有长期价值的经验：Electron main/renderer 文件系统授权边界、项目打开的 pending/activate 状态提交模型、object URL 生命周期、以及 subagent review 抓出的典型风险。

这些内容不适合全部放进 `AGENTS.md`。`AGENTS.md` 应保持短小，主要承载每次会话都必须遵守的硬约束。如果把所有任务复盘、具体实现细节和历史问题都塞进去，会降低指令命中率，也会让后续 agent 更难区分“必须遵守的规则”和“某次任务的上下文记录”。

本设计目标是把经验沉淀到更合适的位置，同时避免增加产品代码或改变现有行为。

## 2. 目标

- 保持 `AGENTS.md` 简洁，不继续扩大为经验仓库。
- 为长期架构原则建立一个稳定文档位置。
- 为本轮项目保存/打开执行复盘建立一个历史记录位置。
- 让后续设计、计划和实现可以引用这些文档，而不需要每次都读冗长的 `AGENTS.md`。

## 3. 非目标

- 不修改产品代码。
- 不修改当前保存/打开实现。
- 不把本轮所有 review 细节塞进 `AGENTS.md`。
- 不创建庞大的文档体系或索引站点。
- 不要求每次任务都读取所有历史复盘。

## 4. 推荐文档结构

新增两个文档层级：

```text
docs/
  architecture/
    electron-project-boundaries.md
  superpowers/
    handoffs/
      2026-05-09-project-save-open-retrospective.md
```

### 4.1 `docs/architecture/electron-project-boundaries.md`

定位：长期架构原则。

该文档记录以后做 Electron project、audio、本地文件访问相关功能时应遵守的边界。它不是任务流水账，也不记录 commit 细节。

建议章节：

```md
# Electron Project Boundaries

## Purpose

## Local Filesystem Authority

## Project Save/Open State Model

## Renderer Activation Pattern

## Audio Data Ownership

## Object URL Lifecycle

## What Project Files Should Not Store

## Verification Expectations
```

应沉淀的长期规则：

- Electron main 是本地文件系统授权边界。
- renderer 传来的路径只能作为 metadata，不能作为 main 读写文件的授权。
- 保存项目时，main 应依赖自己授权过的用户选择结果或明确 token，而不是 renderer 可变路径。
- 打开项目时，main 可以先返回 pending 结果；只有 renderer 成功完成 waveform、media load、seek 等激活步骤后，main 才提交当前项目位置。
- `.ziqi` 保存可恢复项目状态，不保存 waveform、`ArrayBuffer`、blob URL 或 object URL。
- object URL 必须在失败、替换和组件卸载时释放。
- preload/main/renderer 边界变更需要真实 Electron runtime smoke；如果受环境限制无法完成，必须明确标注剩余风险。

### 4.2 `docs/superpowers/handoffs/2026-05-09-project-save-open-retrospective.md`

定位：本轮执行复盘。

该文档记录项目保存/打开任务中实际发生的设计修正、review 发现和流程经验。它可以带有时间性，不要求成为永久架构规则。

建议章节：

```md
# Project Save/Open Retrospective

## What We Built

## Design Decisions That Held Up

## Issues Caught During Review

## Test Cases Added Late

## Process Notes

## Follow-Up Risks
```

应记录的复盘内容：

- 文件夹项目 + `.ziqi` JSON + `audio/` 源音频副本的方向成立。
- 打开项目重新解码 waveform 比保存 waveform 更适合当前阶段。
- 初始实现容易低估 Electron 文件系统授权边界。
- subagent review 抓出了 renderer 任意路径复制、main/App 项目位置错位、partial location request、object URL 生命周期等问题。
- 后续如果补真实 Electron IPC 集成测试，应优先覆盖 main 侧授权状态。

## 5. `AGENTS.md` 边界

本轮不建议修改 `AGENTS.md`。

如果未来确实需要把本轮经验提升为全局硬约束，只允许添加非常短的原则句，例如：

> Renderer-provided file paths are metadata, not filesystem authorization; Electron main must own local file access decisions.

但默认优先把详细内容放入 `docs/architecture/electron-project-boundaries.md`。

## 6. 使用方式

后续任务中：

- 涉及 Electron project save/open、本地文件访问、preload IPC、audio blob URL 生命周期时，应优先查阅 `docs/architecture/electron-project-boundaries.md`。
- 需要理解本轮项目保存/打开任务为什么采用当前形态时，可查阅 retrospective。
- 新功能设计文档可以引用 architecture 文档中的原则，而不是复制整段内容。

## 7. 验收标准

本轮文档整理完成后应满足：

- `AGENTS.md` 不变。
- 新增 architecture 文档，清楚描述 Electron project 边界。
- 新增 retrospective 文档，清楚记录本轮执行经验。
- 两份文档都聚焦，不变成实现计划或产品需求文档。
- 文档内容能帮助后续 agent 避免重复踩同类边界问题。
