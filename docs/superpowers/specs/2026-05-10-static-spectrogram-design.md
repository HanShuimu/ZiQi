# 静态整首频谱显示设计

日期：2026-05-10

## 1. 背景

ZiQi 当前已经完成了真实音频导入、mono waveform overview 生成、基础播放控制、项目保存和项目重新打开。主工作区现在仍然以波形为主要可视化内容，尚未显示真正用于扒谱观察的频谱。

项目早期定位是替代用户高频使用的 wavetone 工作流。wavetone 的核心观察面是固定分辨率整首频谱：黑底，能量从低到高以蓝、绿、黄、红表示，并用音乐音高感更强的纵向坐标帮助判断泛音和基频。下一步应先补齐这一主观察面，而不是优先推进 provider、分轨、自动分析或复杂项目管理能力。

本设计承认频谱显示很难一次达到最终视觉效果。第一版目标是做出真实、可看、可验证、可调整的静态整首 spectrogram，后续再根据真实界面反馈迭代色阶、动态范围、网格密度和坐标细节。

## 2. 目标

- 导入本地音频后生成整首固定分辨率 spectrogram overview。
- 打开已保存项目后，从项目内音频重新生成 spectrogram overview。
- 主工作区显示真实频谱，而不是仅显示 waveform 或静态占位。
- 频谱采用黑底，能量从低到高为蓝、绿、黄、红。
- 频谱纵轴采用对数频率轴，覆盖标准 88 键 A0-C8。
- 频谱左侧显示竖向钢琴键 UI，作为音高坐标参照。
- 波形保留为频谱上方的薄概览条。
- 播放游标贯穿波形概览和频谱区域，并随真实播放位置同步移动。
- 显示淡固定时间网格，帮助用户横向定位。
- 频谱数据作为运行时派生分析数据，不写入 `.ziqi`。

## 3. 非目标

第一版不做以下内容：

- zoom 或 pan。
- hover 显示音名、频率或时间。
- BPM/beat 网格。
- 音名文字标签或完整频率刻度。
- 用户可配置色阶、频率范围或网格间隔。
- 自动裁剪音域。
- 保存 spectrogram 数据到 `.ziqi`。
- waveform 或 spectrogram 缓存。
- Web Worker 后台计算。
- 多通道独立频谱。
- provider、分轨、LLM 分析或自动结论。
- 点击频谱 seek。第一版继续使用现有 transport seek。

## 4. 推荐方案

新增独立 `SpectrogramService`，与现有 `WaveformService` 并列。

`SpectrogramService` 接收音频 `ArrayBuffer`，使用 Web Audio 解码，混合为 mono，并按固定参数生成整首 spectrogram overview。渲染层只接收稳定的 overview 数据并绘制 canvas，不根据容器宽度重新分析音频。

选择该方案的原因：

- 和当前 waveform 分析边界一致：分析数据独立于 UI 渲染尺寸。
- 不把 FFT、色阶、频率映射逻辑塞进 React 组件。
- 便于单元测试频谱数据结构、归一化和失败路径。
- 后续可以在不改 UI 消费方式的前提下优化参数、加入 worker 或缓存。

不采用的方案：

- 把频谱生成塞进现有 `WaveformService`。这会混淆两类不同分析数据的边界。
- 直接在 canvas 里边解码边绘制。这会耦合分析和渲染，后续难以测试和调整。

## 5. 数据结构

第一版新增 spectrogram overview 类型：

```ts
interface SpectrogramOverview {
  durationMs: number;
  framesPerSecond: number;
  minFrequencyHz: number;
  maxFrequencyHz: number;
  binsPerFrame: number;
  frames: SpectrogramFrame[];
}

interface SpectrogramFrame {
  startMs: number;
  endMs: number;
  magnitudes: number[];
}
```

`magnitudes` 是归一化到 `0..1` 的能量值，数组顺序为低频到高频。显示 bins 按对数频率轴组织，而不是先生成线性显示图再在 UI 中拉伸。

第一版频率范围固定为标准钢琴 88 键 A0-C8 对应范围：

- A0：约 27.5 Hz。
- C8：约 4186 Hz。

这不是说更高频率没有价值，而是第一版先服务扒谱时最直接的音高观察。后续如果真实界面反馈显示高频泛音不足，可以扩展为 C8 以上的附加区域，或增加可选频率范围。

## 6. 频谱显示

主观察区由两部分组成：

- 上方薄 waveform overview。
- 下方大 spectrogram canvas。

左侧是一条竖向钢琴键 UI，范围为标准 88 键 A0-C8。钢琴键和 spectrogram 使用同一套 `frequency -> y` 映射，保证音高坐标对齐。

右侧 spectrogram 横轴为整首音频时间，纵轴为对数频率。画布背景为黑色。能量色阶参考 wavetone：

- 低能量：蓝色。
- 中低能量：绿色。
- 中高能量：黄色。
- 高能量：红色。

第一版色阶函数、动态范围压缩、时间帧密度、频率 bin 数、钢琴键宽度和网格间隔集中在小的常量或工具函数中，方便后续根据界面反馈调整。第一版不提供用户可配置 UI。

频谱区域叠加淡固定时间网格。网格只用于横向定位，不绑定 `bpm` 或 `beatOffsetMs`。

播放游标是一条竖线，贯穿 waveform overview 和 spectrogram 区域。它继续根据 `playbackState.currentTimeMs / project.sourceAudio.durationMs` 计算横向位置。

## 7. 数据流

导入音频成功路径：

1. Electron main 通过系统文件对话框读取用户选择的音频 bytes。
2. Renderer 创建 playback object URL。
3. `WaveformService` 从音频 bytes 生成 `WaveformOverview`。
4. `SpectrogramService` 从同一份音频 bytes 生成 `SpectrogramOverview`。
5. Audio facade 加载 playback URL，并 seek 到 0。
6. `App` 提交 project、waveform overview、spectrogram overview 和 playback URL。

打开项目成功路径：

1. Electron main 读取 `.ziqi` 和项目内音频 bytes。
2. Renderer 创建新的 playback object URL。
3. Renderer 重新生成 waveform overview。
4. Renderer 重新生成 spectrogram overview。
5. Audio facade 加载项目音频，并 seek 到 0。
6. Renderer 调用 `activateOpenedProject`。
7. `App` 提交打开后的 project、waveform overview、spectrogram overview 和 project location。

频谱生成是项目激活前置条件之一。如果导入或打开过程中频谱生成失败，本次操作失败，不切换到新项目。

## 8. 模块边界

### 8.1 `src/domain/audio/spectrogram.ts`

职责：

- 定义 `SpectrogramOverview` 和 `SpectrogramFrame`。
- 定义钢琴音域和对数频率映射相关工具。
- 定义能量归一化或色阶输入所需的纯函数。

不负责：

- Web Audio 解码。
- DOM/canvas 绘制。
- React 状态管理。

### 8.2 `src/domain/audio/browserSpectrogramService.ts`

职责：

- 接收音频 `ArrayBuffer`。
- 使用 Web Audio 解码。
- 混合多声道为 mono。
- 按固定参数执行 STFT/FFT。
- 输出 `SpectrogramOverview`。

不负责：

- 读取本地文件路径。
- 管理 playback URL。
- 绘制 canvas。
- 保存项目文件。

### 8.3 `App`

职责：

- 在导入和打开流程中编排 waveform 与 spectrogram 生成。
- 管理当前 `SpectrogramOverview` 状态。
- 在失败时保留旧项目和旧运行时资源。

不负责：

- 频谱算法细节。
- canvas 绘制细节。

### 8.4 `WorkbenchShell`

职责：

- 接收 `spectrogramOverview`。
- 显示 waveform 概览条、钢琴键 UI 和 spectrogram canvas。
- 显示播放游标和固定时间网格。
- 显示 loading、empty 或 error 状态。

不负责：

- 解码音频。
- 生成 spectrogram 数据。
- 修改项目保存格式。

## 9. 错误处理

错误文案使用：

```text
Failed to generate spectrogram.
```

导入新音频时，如果 spectrogram 生成失败：

- 不创建新项目。
- 不替换当前 project。
- 不替换当前 playback URL。
- 不替换当前 waveform 或 spectrogram。

打开项目时，如果 spectrogram 生成失败：

- 保留当前可见项目。
- 保留当前 playback URL。
- 保留当前 waveform 和 spectrogram。
- 不激活新项目 location。

频谱生成中沿用现有 importing/opening 状态。第一版不新增单独进度条。

## 10. 测试策略

单元测试：

- `SpectrogramService` 能从可控音频输入生成固定帧数和固定 bin 数。
- `magnitudes` 归一化范围保持在 `0..1`。
- 静音输入生成低能量或零能量频谱。
- 解码失败返回稳定错误。
- 对数频率映射在 A0-C8 范围内单调且可预测。

组件测试：

- 导入成功后 `App` 将 waveform 和 spectrogram 传给 `WorkbenchShell`。
- 导入时 spectrogram 失败不会创建或替换项目。
- 打开项目时 spectrogram 失败保留旧项目。
- `WorkbenchShell` 有 spectrogram 时显示频谱 canvas 和钢琴键 UI。
- 播放游标按当前时间同步到 waveform 和 spectrogram。

验证命令：

```text
npm test
npm run build
```

Electron smoke：

- 导入真实音频后能看到整首频谱。
- 频谱采用黑底蓝绿黄红配色。
- 左侧钢琴键 UI 显示并与频谱纵向坐标对齐。
- 播放、暂停、seek 仍然工作。
- 播放游标在 waveform 和 spectrogram 上同步移动。
- 打开已保存项目后，频谱从项目内音频重新生成。

## 11. 分阶段验收

第一阶段验收：

- 主工作区显示真实整首静态 spectrogram。
- 波形作为上方薄概览条保留。
- 频谱为黑底蓝绿黄红能量图。
- 频谱纵轴为 A0-C8 的对数频率轴。
- 左侧有 88 键钢琴 UI。
- 有固定时间网格。
- 播放游标同步。
- 频谱不写入 `.ziqi`。
- 失败路径不破坏当前项目状态。

第二阶段根据真实界面反馈决定是否调整：

- 色阶强弱和动态范围。
- 噪声底处理。
- 频率范围是否扩展到 C8 以上。
- 钢琴键宽度和可读性。
- 时间网格密度。
- 是否增加音名标签、hover 信息、zoom/pan。
- 是否引入 worker 或缓存。

## 12. 结论

本轮应优先实现固定分辨率整首静态 spectrogram，让 ZiQi 的主观察面从 waveform 升级为真正面向扒谱的频谱视图。

第一版刻意保持范围克制：真实频谱、对数音高坐标、钢琴键参照、wavetone 风格色阶、固定时间网格和播放游标同步。它不追求最终视觉一次到位，而是为后续基于真实界面反馈的调参和交互迭代打下清晰边界。
