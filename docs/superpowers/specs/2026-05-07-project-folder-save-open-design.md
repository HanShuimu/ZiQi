# 文件夹项目保存与打开设计

日期：2026-05-07

## 1. 背景

当前应用已经能从 Electron 桌面端选择本地音频、把音频数据交给 renderer、生成真实 mono waveform overview，并在工作台中完成基础播放、暂停和 seek。下一步需要把这个“单次导入会话”提升为可保存、可重新打开的项目。

当前产品还没有真实标记编辑、provider 运行、项目内派生资产、真实频谱视口保存或最近项目列表。因此本轮项目保存不应设计成完整项目管理系统，也不应保存可以从源音频重新生成的派生数据。第一版只建立稳定项目边界：项目文件夹拥有自己的源音频副本和项目清单，重新打开项目时从项目内音频重新生成当前所需的 waveform。

## 2. 目标

本轮目标是支持最小文件夹项目：

- 用户可以把当前已导入的音频项目保存成一个项目文件夹。
- 项目文件夹内包含一个 `.ziqi` 主项目文件和一份源音频副本。
- 项目重新打开后不依赖用户原始音频路径。
- 项目重新打开时重新读取项目内音频副本，并重新解码生成 waveform overview。
- 当前已有的 `ProjectSummary` 和 `workspace` 状态可以通过 `.ziqi` 恢复。
- 保存和打开能力通过 Electron main/preload 暴露，renderer 不直接读写本地文件系统。
- renderer 维护当前项目位置状态，用于区分未保存项目和已保存项目。

## 3. 非目标

本轮明确不做以下内容：

- 不保存 `WaveformOverview`。
- 不保存音频 `ArrayBuffer`、blob URL、object URL 或其他运行时音频数据。
- 不做自动保存。
- 不做最近项目列表。
- 不做覆盖已有项目文件夹的复杂交互。
- 不做项目导出为单一压缩包或二进制包。
- 不做数据库、索引服务或迁移框架。
- 不新增标记编辑、provider 运行、真实频谱、派生资产生成等产品功能。

## 4. 项目文件夹结构

第一版项目采用文件夹项目：

```text
Demo Track.ziqiproject/
  Demo Track.ziqi
  audio/
    demo track.wav
```

`.ziqiproject` 是项目文件夹。`.ziqi` 是项目主清单文件，内容格式为 UTF-8 JSON。它不是压缩包，也不是二进制私有格式；扩展名用于表达产品语义，并为后续系统文件关联留空间。

创建项目时，项目文件夹名和 `.ziqi` 文件名保持一致。打开项目时不要求文件夹名和 `.ziqi` 文件名一致，只要求用户选中一个合法 `.ziqi` 文件。这样用户手动重命名外层文件夹不会破坏项目。

## 5. `.ziqi` 文件格式

第一版 `.ziqi` 文件结构如下：

```json
{
  "format": "ziqi.project",
  "schemaVersion": 1,
  "project": {
    "id": "project-2026-05-07T12:00:00.000Z",
    "name": "Demo Track",
    "sourceAudio": {
      "id": "source-2026-05-07T12:00:00.000Z",
      "name": "demo track.wav",
      "durationMs": 120000,
      "sampleRate": 0,
      "channelCount": 2,
      "filePath": "audio/demo track.wav"
    },
    "assets": [],
    "analysisRuns": [],
    "annotations": [],
    "workspace": {
      "preset": "spectrum-analysis",
      "activeDock": "analysis",
      "gridEnabled": true,
      "bpm": 120,
      "beatOffsetMs": 0,
      "playbackRate": 1
    }
  }
}
```

`format` 固定为 `ziqi.project`。`schemaVersion` 固定为 `1`。`project` 保存当前 `ProjectSummary`。

`project.sourceAudio.filePath` 在保存成功后必须指向项目内相对路径，例如 `audio/demo track.wav`。打开项目时只使用这个项目内相对路径查找源音频副本，不依赖导入时的原始音频路径。

第一版不保存 `originalFilePath`。如果后续需要展示来源记录，可以再增加只读来源字段，但它不应参与播放、解码或项目恢复。

## 6. 保存流程

保存入口只在当前已有项目时可用。没有项目时，`Save Project` 应禁用或不执行。

第一版保存分为两种情况：

- 未保存项目：从导入音频创建，但还没有项目文件夹。保存时创建项目文件夹，复制源音频，写入 `.ziqi`。
- 已保存项目：已经有 `projectFilePath` 和 `projectRootPath`。保存时只原地重写 `.ziqi`，不重复复制源音频。

未保存项目的保存流程：

1. 用户点击 `Save Project`。
2. renderer 将当前 `ProjectSummary` 传给 preload/main。此时 `project.sourceAudio.filePath` 仍是导入音频的原始绝对路径。
3. Electron main 让用户选择项目父目录。
4. main 基于项目名创建 `<Project Name>.ziqiproject/`。
5. main 创建 `audio/` 子目录。
6. main 将当前项目的源音频复制到 `audio/<sourceAudio.name>`。
7. main 写入 `<Project Name>.ziqi`。
8. main 返回保存后的 `ProjectSummary`、项目文件路径和项目根目录路径。
9. renderer 用返回的 `ProjectSummary` 更新当前项目状态。

保存成功后，当前项目状态里的 `sourceAudio.filePath` 从原始音频绝对路径更新为项目内相对路径。这样从保存成功开始，项目不再依赖原始音频位置。

已保存项目的保存流程：

1. 用户点击 `Save Project`。
2. renderer 将当前 `ProjectSummary`、`projectFilePath` 和 `projectRootPath` 传给 preload/main。
3. main 校验 `project.sourceAudio.filePath` 指向项目内相对路径。
4. main 原地重写现有 `.ziqi`。
5. main 不复制音频，也不重新读取音频数据。
6. renderer 保持当前项目状态。

第一版如果目标项目文件夹已经存在，保存失败并显示稳定错误。覆盖、合并、改名建议暂不做，避免过早引入文件冲突策略。

## 7. 打开流程

打开入口让用户选择 `.ziqi` 文件，而不是选择项目文件夹。

打开流程：

1. 用户点击 `Open Project`。
2. Electron main 打开文件选择框，过滤 `.ziqi` 文件。
3. 用户取消时静默返回。
4. main 读取 `.ziqi`，解析 JSON，并校验 `format`、`schemaVersion` 和基础项目结构。
5. main 以 `.ziqi` 所在目录为项目根目录，解析 `project.sourceAudio.filePath` 指向的项目内音频副本。
6. main 读取项目内音频副本，返回 `project`、`audioData`、`projectFilePath` 和 `projectRootPath`。
7. renderer 用 `audioData` 创建 playback blob URL。
8. renderer 用同一份 `audioData` 重新解码生成 waveform overview。
9. renderer 加载音频 metadata，设置当前 `project` 和 `waveformOverview`。

打开项目复用当前导入音频的 renderer 链路：同样创建 playback blob URL，同样调用 waveform service，同样设置工作台状态。这样不会多出一套平行音频加载逻辑。

## 8. 模块边界

### 8.1 Electron main/preload

职责：

- 打开项目保存位置选择对话框。
- 创建项目文件夹和子目录。
- 复制源音频文件。
- 写入 `.ziqi` JSON 文件。
- 打开 `.ziqi` 文件选择对话框。
- 读取并校验 `.ziqi` 文件。
- 读取项目内音频副本。
- 通过 preload 暴露 `saveProject` 和 `openProject`。

不负责：

- 生成 waveform。
- 管理 React 状态。
- 执行播放控制。
- 保存或缓存 Web Audio 解码结果。

### 8.2 Renderer App

职责：

- 管理当前 `ProjectSummary`、`WaveformOverview`、导入/保存/打开错误状态。
- 管理当前项目位置状态：`projectFilePath` 和 `projectRootPath`。
- 调用 `window.ziqiApp.saveProject`。
- 调用 `window.ziqiApp.openProject`。
- 打开项目后复用现有音频加载和 waveform 生成流程。
- 将项目和 waveform 传给 `WorkbenchShell`。

不负责：

- 直接读写本地文件系统。
- 拼接真实本地路径。
- 复制源音频文件。

### 8.3 Domain project store

建议新增小型纯函数边界：

- `projectFile.ts`：定义 `.ziqi` payload 类型、创建 payload、解析和校验 payload。
- `projectPaths.ts`：处理项目文件夹名、`.ziqi` 文件名、项目内音频相对路径和文件名清理。

这些函数不依赖 Electron、React 或 DOM，便于单元测试。

## 9. 错误处理

第一版错误处理保持稳定、简单：

- 用户取消保存：静默返回，不改变当前项目。
- 用户取消打开：静默返回，不改变当前项目。
- 没有当前项目时保存：保存入口禁用。
- 保存文件夹已存在：显示 `Failed to save project.`
- 复制音频失败：显示 `Failed to save project.`
- 写入 `.ziqi` 失败：显示 `Failed to save project.`
- `.ziqi` 不是合法 JSON：显示 `Failed to open project.`
- `.ziqi` 的 `format` 或 `schemaVersion` 不匹配：显示 `Failed to open project.`
- 项目内音频副本不存在或无法读取：显示 `Failed to load project audio.`
- 打开项目后音频解码失败：沿用 `Failed to decode audio waveform.`

保存失败时不应修改当前项目状态。打开失败时保留当前项目状态。

## 10. UI 行为

第一版只需要最小 UI 接线：

- 顶部命令区的 `Open Project` 调用打开流程。
- 顶部命令区新增或启用 `Save Project`。
- 没有项目时 `Save Project` 禁用。
- 保存/打开进行中时对应按钮禁用，并显示简单进行中文案。
- 错误文案沿用当前工作台里的错误显示方式。

不新增项目浏览器、最近项目列表、保存状态徽章或自动保存提示。

## 11. 测试策略

单元测试：

- `.ziqi` payload 创建时包含 `format: "ziqi.project"` 和 `schemaVersion: 1`。
- 保存 payload 中的 `sourceAudio.filePath` 是项目内相对路径。
- 解析合法 `.ziqi` 能恢复 `ProjectSummary`。
- 非 JSON、错误 `format`、不支持的 `schemaVersion` 会返回稳定失败。
- 项目路径工具能生成 `.ziqiproject` 文件夹名、`.ziqi` 文件名和 `audio/` 相对路径。

组件测试：

- 没有项目时 `Save Project` 不可用。
- 保存成功后当前项目更新为项目内音频路径。
- 已保存项目再次保存时不会重复复制源音频。
- 打开项目成功后显示项目和重新生成的 waveform。
- 打开项目取消时不改变当前项目。
- 打开缺失音频的项目显示稳定错误。

集成验证：

- `npm test`
- `npm run build`
- Electron smoke test 确认 `window.ziqiApp.saveProject` 和 `window.ziqiApp.openProject` 存在。
- 手动导入音频、保存项目、关闭或替换当前项目、重新打开 `.ziqi`，确认项目显示、音频播放和 waveform 重新生成。

## 12. 验收标准

本轮完成后应满足：

- 用户可以把已导入音频的项目保存为文件夹项目。
- 项目文件夹内有一个 `.ziqi` 主文件和一份 `audio/` 下的源音频副本。
- `.ziqi` 是 JSON 格式的项目清单文件。
- 保存后的项目不依赖原始音频路径。
- 用户可以选择 `.ziqi` 重新打开项目。
- 重新打开项目时 waveform 由项目内音频重新解码生成，而不是从保存文件读取。
- 取消、保存失败、打开失败都不会破坏当前项目状态。
- 测试、构建和 Electron preload 烟测通过。

## 13. 后续扩展

该设计为后续内容保留空间：

- Timeline annotations 保存和恢复。
- Workspace 视口、光标、网格、声道模式和 EQ 设置保存。
- Derived audio assets 写入项目子目录并由 `.ziqi` 索引。
- Analysis runs 和 provider artifacts 写入项目子目录并由 `.ziqi` 索引。
- 最近项目列表。
- 自动保存。
- 将 `.ziqi` 注册为系统可打开文件类型。
- 需要时增加导出单文件包能力，但不影响第一版文件夹项目。
