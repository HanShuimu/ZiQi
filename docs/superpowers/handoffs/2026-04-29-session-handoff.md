# 会话接力说明

日期：2026-04-29

## 当前状态

仓库已经包含以下内容：

- 设计文档：`docs/superpowers/specs/2026-04-29-transcription-workbench-design.md`
- 实现计划：`docs/superpowers/plans/2026-04-29-transcription-workbench-implementation-plan.md`
- 第一版 `Electron + React + TypeScript + Vite` 项目骨架
- 初始工作台主界面骨架
- 项目数据模型第一版
- 音频能力抽象接口第一版
- mock 音频 facade 与 mock 频谱渲染

## 已完成实现

### 桌面应用骨架

- `electron/main.ts`
- `electron/preload.ts`
- `src/main.tsx`
- `src/App.tsx`

已建立基本 Electron 主进程、preload 桥接和 React renderer 入口。

### 工作台界面骨架

- `src/components/WorkbenchShell.tsx`
- `src/styles.css`

当前界面已经体现以下结构：

- 顶部命令区
- 左侧项目 rail
- 中央主频谱区
- 下方 dock tabs 和 dock panels
- 底部 transport 区

### 领域模型

- `src/domain/project/types.ts`
- `src/domain/project/mockProject.ts`
- `src/domain/audio/types.ts`
- `src/domain/audio/interfaces.ts`
- `src/domain/audio/mockFacade.ts`

已定义的重点边界：

- `ProjectSummary`
- `SourceAudio`
- `DerivedAudioAsset`
- `AnalysisRun`
- `TimelineAnnotation`
- `WorkspaceState`
- `AudioSourceService`
- `PlaybackService`
- `AnalysisDataService`
- `AudioProcessingService`
- `ProjectAudioFacade`

## 已验证事项

以下命令已经成功通过：

- `npm install`
- `npm run build`

注意：

- `npm install` 时出现 `1 high severity vulnerability`
- 当前没有处理 `npm audit fix --force`
- 这个问题暂时不阻塞骨架阶段

## 当前实现意图

当前代码不是成品音频工具，而是为后续真实音频接入预留稳定边界。

当前 mock 结构的目的：

- 先让主工作区结构成立
- 先把项目模型与音频抽象接口定住
- 避免后续把真实音频实现直接耦合进界面层

## 下一步优先级

推荐下一会话优先推进以下顺序：

1. 实现真实 `PlaybackService`
2. 接入本地音频导入与项目创建
3. 用真实分析数据替换 mock 频谱

更具体地说，建议先做 `PlaybackService`，因为它是 `wavetone-compatible core` 的第一条硬主线，直接影响：

- 从当前位置播放
- 暂停
- seek
- 变速不变调
- loop range

## 建议开发策略

下一会话应继续保持以下原则：

- 先打通主频谱工作流，不要先扩展 AI/provider
- 保持界面层只依赖 `ProjectAudioFacade`
- 不要让 renderer 直接依赖具体音频库
- provider 系统先不动，除非主工作流已经可用

## 风险提醒

- 变速不变调的真实实现可能需要专门音频库，不宜自行硬做
- 频谱分析与播放控制不一定来自同一个底层库
- 跨平台风险主要在音频与本地 provider，不在 Electron 界面本身

## 接手建议

如果由其他会话继续执行，建议先阅读以下文件：

1. `docs/superpowers/specs/2026-04-29-transcription-workbench-design.md`
2. `docs/superpowers/plans/2026-04-29-transcription-workbench-implementation-plan.md`
3. `src/domain/audio/interfaces.ts`
4. `src/components/WorkbenchShell.tsx`

然后从“真实音频播放链路”开始继续实现。
