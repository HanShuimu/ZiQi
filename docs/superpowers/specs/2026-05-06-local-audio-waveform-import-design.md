# 本地音频导入与真实波形闭环设计

日期：2026-05-06

## 1. 背景

当前仓库已经有桌面应用骨架、工作台界面、项目模型和若干音频相关模块，但端到端用户流程仍不能作为已跑通来判断。下一步应优先补齐最小真实音频闭环，而不是继续推进项目保存、provider、真实频谱或复杂观察增强。

本设计聚焦一条用户可验证的主线：

1. 选择本地音频文件
2. 解码真实音频
3. 创建项目
4. 显示真实 mono 波形
5. 播放、暂停、seek 时同步播放位置

## 2. 目标

本轮目标是让用户在桌面应用中完成一次真实音频导入和基础观察：

- 点击 `Import Audio` 后选择一个本地音频文件。
- 应用基于该音频创建项目。
- 应用从真实音频 PCM 数据生成 mono waveform overview。
- 主工作区显示真实波形，而不是 mock 频谱或假数据。
- `Play`、`Pause`、`Seek` 控制真实音频播放。
- 播放游标和 transport 进度跟随真实播放位置更新。

## 3. 非目标

本轮明确不做以下内容：

- 左右声道分开展示。
- 真实频谱、FFT、音高坐标或泛音参考线。
- 项目保存、打开和工作现场恢复。
- provider 任务流、分轨、分析或 LLM 入口。
- 波形缓存、后台 worker、多分辨率波形或局部高精度重算。
- 完整音频编辑、导出或标记系统。

## 4. 推荐方案

采用 renderer 侧 Web Audio 解码方案。

Electron main/preload 继续只负责选择本地音频文件，并把 `filePath` 返回给 renderer。renderer 将本地路径转换为可播放、可读取的音频 URL，使用 `HTMLAudioElement` 负责播放，使用 `AudioContext.decodeAudioData` 解码真实音频并生成波形数据。

选择该方案的原因：

- 和当前 React renderer 与浏览器音频播放结构贴合。
- 不需要把大音频 buffer 通过 IPC 从 main process 传给 renderer。
- 能用最少架构改动验证核心产品闭环。
- 后续如有性能瓶颈，可以把波形生成实现迁移到 worker 或 main process，而不推翻 UI 和项目模型边界。

## 5. 数据边界

波形数据属于音频分析数据，不属于 UI 渲染参数。UI 不决定分析分辨率，也不要求为了不同屏幕宽度重新解码音频。

第一版生成稳定的 mono waveform overview：

```ts
interface WaveformOverview {
  pointsPerSecond: number;
  durationMs: number;
  points: WaveformPoint[];
}

interface WaveformPoint {
  startMs: number;
  endMs: number;
  peak: number;
}
```

第一版使用：

- `pointsPerSecond = 50`
- 每个点覆盖约 `20ms`
- `peak` 归一化为 `0..1`
- 多声道音频先混合为 mono，再计算峰值

渲染层可以为了适配屏幕做绘制层面的抽样或聚合，但不能改变 `WaveformOverview` 原始数据，也不能把容器宽度反向传给分析层作为重算依据。

## 6. 模块边界

### 6.1 Electron main/preload

职责：

- 打开本地音频选择对话框。
- 返回选中文件的 `filePath`。

不负责：

- 解码音频。
- 生成波形。
- 管理播放状态。

### 6.2 BrowserProjectAudioFacade

职责：

- 把本地音频文件加载进播放用的 `HTMLAudioElement`。
- 暴露音频 metadata，例如时长、声道数和采样率。
- 继续作为 UI 层访问音频能力的 facade。

不负责：

- 渲染波形。
- 执行 provider 或分析任务。

### 6.3 WaveformService

职责：

- 接收本地音频 URL 或可读取的音频源。
- 使用 Web Audio 解码音频。
- 将多声道音频混合为 mono。
- 按固定 `pointsPerSecond` 生成 `WaveformOverview`。

不负责：

- 读取 UI 容器宽度。
- 绘制波形。
- 管理 React 状态。

### 6.4 App

职责：

- 串联导入流程：
  1. 调用 `selectAudioFile`
  2. 加载播放源
  3. 生成真实波形
  4. 创建项目
  5. 把项目和波形传给工作台
- 管理导入中、失败和当前项目状态。

### 6.5 WorkbenchShell

职责：

- 展示项目摘要。
- 展示真实 waveform overview。
- 展示播放游标和 transport 进度。
- 调用 facade 的播放、暂停和 seek 方法。

不负责：

- 解码音频。
- 生成波形数据。

## 7. 用户流程

成功路径：

1. 用户点击 `Import Audio`。
2. 应用打开系统文件选择框。
3. 用户选择音频文件。
4. 应用加载音频并读取 metadata。
5. 应用解码音频并生成 mono waveform overview。
6. 应用创建项目并进入工作台视图。
7. 工作台显示文件名、基础 metadata 和真实波形。
8. 用户点击 `Play` 开始播放真实音频。
9. 用户拖动 seek 控件后，播放位置和波形游标同步更新。

取消路径：

- 用户取消文件选择时，不创建项目，不显示错误。

失败路径：

- 文件无法加载、无法解码或 metadata 获取失败时，保留当前项目状态，并在导入入口附近显示明确错误。

## 8. 错误处理

第一版错误处理保持简单：

- 选择文件取消：静默返回。
- 播放源加载失败：显示 `Failed to load audio file.`。
- Web Audio 解码失败：显示 `Failed to decode audio waveform.`。
- 播放失败：显示 `Failed to play audio.` 或保留现有错误入口。

错误文案不需要覆盖所有底层异常细节，但测试应覆盖取消、解码失败和成功路径。

## 9. 测试策略

单元测试：

- `WaveformService` 能按 `pointsPerSecond = 50` 生成稳定点数。
- 多声道输入会混合为 mono。
- `peak` 值保持在 `0..1`。
- 空音频或解码失败会返回明确错误。

组件测试：

- 未加载项目时显示导入入口。
- 导入成功后显示项目和真实波形区域。
- 点击 `Play`、`Pause`、拖动 seek 时调用对应 facade 方法。

集成验证：

- `npm test`
- `npm run build`
- 在 Electron 应用中手动选择一个本地音频文件，确认项目创建、波形显示和播放 seek 同步。

## 10. 验收标准

本轮完成后应满足：

- 用户可以从桌面应用选择本地音频并创建项目。
- 主工作区显示由真实音频数据生成的 mono 波形。
- 波形不是 mock 数据，也不是静态占位。
- 播放、暂停、seek 能控制真实音频。
- 播放位置在 transport 和波形游标中同步表现。
- 现有测试和构建通过。

## 11. 后续扩展

本设计刻意保留以下后续空间：

- 左右声道分开展示。
- 多分辨率波形缓存。
- 局部 zoom 和更高精度局部波形。
- 真实频谱渲染。
- 项目保存时持久化 waveform overview 或其缓存索引。
- provider 结果回挂到同一项目模型。
