# 工作台菜单与顶部命令区清理设计

日期：2026-05-13

## 1. 背景

当前工作台在页面顶部有一条 `command-strip`，其中混放了文件级命令、播放命令、显示开关和 provider 入口：

- `Open Project`
- `Save Project`
- `Import Audio`
- `Play from Cursor`
- `Toggle Grid`
- `Run Stem Provider`
- `Run Analysis`

这条命令区的职责不清，会让用户误以为所有入口都属于同一层级。文件级命令更适合桌面应用的原生菜单栏；播放控制应属于 transport；网格和 provider 入口如果还只是占位按钮，就不应提前出现在主工作台里。

本设计只处理这部分 UI 清理，不展开 Startup 页面、不新增 provider 流程、不重做整体工作台布局。

## 2. 目标

本轮目标是让工作台顶部回到清晰的信息展示职责，并把文件级命令移动到 Electron 原生菜单栏：

- 将 `Open Project`、`Save Project`、`Import Audio` 从页面命令区移到原生 `File` 菜单。
- 删除页面顶部的 `command-strip`。
- 移除当前顶部命令区里的占位按钮：`Toggle Grid`、`Run Stem Provider`、`Run Analysis`。
- 不在顶部保留 `Play from Cursor`；播放控制应移动到频谱面板下方，与时间导航控件形成同一组控制。
- 将现有远离频谱的底部 transport 收拢为频谱下方的统一 playback/timeline control。
- 将 `Play` 和 `Pause` 改为单个切换按钮，并根据 `playbackState.isPlaying` 更新文案。
- 支持空格键播放切换：停止或暂停时播放，播放中暂停。
- 保留当前 `topbar` 的工作台标题、preset 和 app version 信息。

## 3. 非目标

本轮明确不做：

- 不设计或实现完整 Startup 页面细节。
- 不保留空项目状态里的大号 `Import Audio` 主按钮。
- 不新增最近项目、欢迎页快捷入口、保存状态徽章或自动保存提示。
- 不实现 `Toggle Grid` 的新位置或交互。
- 不实现 `Run Stem Provider` 或 `Run Analysis` 的局部入口。
- 不新增 provider 配置、运行、队列或结果挂载流程。
- 不在本轮设计完整循环播放、速度、声道模式、beat offset 编辑器。
- 不重构整体工作台视觉风格。

## 4. 原生菜单设计

Electron 主进程应创建原生应用菜单。文件级命令放在 `File` 菜单下：

- `File > Open Project`
- `File > Save Project`
- `File > Import Audio`

这些菜单项调用现有 renderer 中已经存在的项目打开、保存和音频导入行为。菜单项不应绕过现有 renderer 状态管理，也不应让 renderer 直接读写本地文件系统。

macOS 适配遵循 Electron 原生菜单习惯：

- macOS 的第一项应用菜单保留系统标准行为。
- `Open Project`、`Save Project`、`Import Audio` 放入 `File` 菜单。
- 后续可以增加平台快捷键，例如 `Cmd+O`、`Cmd+S`，但快捷键不是本轮必须范围。

Windows 和 Linux 上同样使用窗口原生菜单栏中的 `File` 菜单。

## 5. 导入语义

`Import Audio` 的语义是“选择一份音频并创建一个新项目”。

当当前没有项目时，导入音频会创建新项目。

当当前已有项目时，导入音频会用新音频创建一个新项目，并替换当前工作台中的项目状态。它不是向当前项目追加素材，也不是在当前项目内替换 source audio。

本轮先不设计未保存变更拦截。如果后续引入 dirty state，再为 `Import Audio`、`Open Project` 和关闭窗口统一设计确认流程。

## 6. 工作台页面行为

页面中的 `command-strip` 应整体移除。

移除后，工作台顶部只保留信息展示型 `topbar`：

- `ZiQi Workbench`
- `Transcription Workbench`
- 当前 preset
- app version

已加载项目时，主工作区仍由左侧项目 rail、主频谱面板和 dock 区组成。播放控制不再作为远离频谱的底部 footer 出现，而是收拢到主频谱面板下方。

空项目状态可以继续存在为 Startup 页面占位概念，但本轮不设计具体内容，也不在页面中保留大号 `Import Audio` 按钮。用户通过 `File > Import Audio` 开始创建项目。

## 7. 现有按钮处理

`Open Project`、`Save Project`、`Import Audio`：

- 从页面命令区移除。
- 进入原生 `File` 菜单。
- 继续复用现有打开、保存、导入流程和忙碌状态。

`Play from Cursor`：

- 从顶部命令区移除。
- 不保留独立 `Play from Cursor` 文案。
- 播放行为进入频谱下方的统一 playback/timeline control。

`Toggle Grid`：

- 当前作为占位按钮移除。
- 未来如实现，应归属于谱图视图设置，而不是文件级或全局命令区。

`Run Stem Provider`：

- 当前作为占位按钮移除。
- 未来如实现，应归属于 Stems dock 或 provider 运行流程。

`Run Analysis`：

- 当前作为占位按钮移除。
- 未来如实现，应归属于 Analysis dock 或分析运行流程。

## 8. Playback / Timeline 控制区

当前工作台的播放控制距离频谱位置过远：频谱面板内已有 waveform overview 和 `SpectrogramTimelineNavigator`，但真正的 `Play`、`Pause` 和 seek 位于更下方的 footer transport。用户在观察频谱时需要把视线移出主工作区，播放条与频谱下方的时间导航也形成重复。

本轮采用“频谱下方合并控制条”方案：

```text
Raw Spectrum header
Waveform overview
Spectrogram canvas
[ Play/Pause ]  current / duration  [ timeline seek + viewport navigator ]
```

统一 playback/timeline control 应位于主频谱面板内部、频谱画布下方，和现有 `SpectrogramTimelineNavigator` 视觉上形成同一组控件。实现时可以在同一组件边界内组合播放按钮、时间标签、seek 进度和 viewport navigator；如果技术上需要保留独立子组件，也应在视觉和布局上呈现为一组控件，而不是分散到远离频谱的 footer。

播放按钮改为单个切换按钮：

- 当 `playbackState.isPlaying` 为 `false` 时，按钮文案为 `Play`，点击后从当前播放位置开始播放。
- 当 `playbackState.isPlaying` 为 `true` 时，按钮文案为 `Pause`，点击后暂停。
- 不再同时显示两个互相矛盾的 `Play` 和 `Pause` 按钮。
- 按钮状态和文案只由真实 playback state 驱动，不维护一份独立 UI 播放状态。

seek 行为继续基于真实 media playback：

- 用户拖动或点击 timeline seek 时调用现有 seek 行为。
- 正常播放时 current time 来自 playback service，而不是由 UI 定时模拟。
- 播放光标、波形预览、频谱光标和 timeline playhead 应继续使用同一 `currentTimeMs`。

空格键作为播放切换快捷键：

- 有项目加载时，按空格键触发和切换按钮相同的行为。
- 停止或暂停时，空格键播放。
- 播放中，空格键暂停。
- 当焦点位于文本输入、按钮、range slider 或其他需要自身处理空格键的控件上时，不抢占该控件的默认行为。

原 footer transport 不再作为独立底部模块保留。`Loop: off`、`Beat offset` 和 `Channel mode` 这些信息本轮不需要迁移为完整控制；如果仍需展示，只能作为轻量 meta 保留在频谱相关区域，不能重新撑出远离频谱的 transport 区。

## 9. 测试策略

组件测试：

- 验证工作台不再渲染 `Open Project`、`Save Project`、`Import Audio` 的顶部命令按钮。
- 验证工作台不再渲染 `Play from Cursor`、`Toggle Grid`、`Run Stem Provider`、`Run Analysis` 的顶部命令按钮。
- 验证频谱下方渲染单个播放切换按钮。
- 验证 `playbackState.isPlaying` 为 `false` 时按钮显示 `Play`，点击会调用播放。
- 验证 `playbackState.isPlaying` 为 `true` 时按钮显示 `Pause`，点击会调用暂停。
- 验证 seek 行为仍然可用，并继续调用现有 playback seek。
- 验证有项目加载时空格键可以播放或暂停。
- 验证焦点位于输入控件、按钮或 range slider 时，空格键不抢占控件自身行为。
- 验证空项目状态不再依赖大号 `Import Audio` 按钮。

Electron 边界验证：

- 验证运行中的 Electron 应用暴露 `window.ziqiApp`。
- 验证原生菜单中存在 `File > Open Project`、`File > Save Project`、`File > Import Audio`。
- 验证菜单项能触发现有 renderer 流程，而不是绕过 preload/main 边界。

常规验证：

- `npm test`
- `npm run build`
- Electron smoke test

## 10. 验收标准

本轮完成后应满足：

- 页面顶部不再有混合职责的 `command-strip`。
- 文件级命令位于 Electron 原生 `File` 菜单。
- 占位按钮不会出现在主工作台顶部。
- 播放控制位于频谱下方，并和 timeline/viewport navigator 形成同一组控制。
- 工作台不再出现远离频谱的底部 transport footer。
- `Play` / `Pause` 合并为单个状态切换按钮，按钮文案随 `playbackState.isPlaying` 更新。
- 空格键可以在停止或暂停时播放、播放中暂停。
- `Import Audio` 在有无当前项目时都表示创建新项目；已有项目会被新导入项目替换。
- 空项目不显示大号 `Import Audio` 主按钮，Startup 页面细节留待后续设计。
