# Browser Visual Companion Workflow

Date: 2026-05-23

## Purpose

This document records the workflow that successfully enabled browser-based visual brainstorming in the current Windows/Codex desktop environment.

Use this when a future session needs to show mockups, diagrams, layout comparisons, or other temporary visual material in the in-app browser.

## Successful Approach

Use the persistent `node_repl` MCP kernel to host a small local HTTP server.

In this environment, the reliable URL was:

```text
http://localhost:63888
```

The server reads an HTML fragment from `.superpowers/brainstorm/.../content/*.html`, wraps it in a lightweight page shell, and serves it to the browser. To switch screens, update the global content path in the Node REPL.

## Step 1: Create a Brainstorm Content Directory

Create a session directory under:

```text
D:\WORKSPACE\ZiQi\.superpowers\brainstorm\
```

Recommended shape:

```text
.superpowers/brainstorm/<session-id>/
  content/
```

Example:

```text
D:\WORKSPACE\ZiQi\.superpowers\brainstorm\visual-session\content\
```

The `.superpowers/` directory is already ignored by git.

## Step 2: Write an HTML Fragment

Create one HTML fragment per visual screen.

Example file:

```text
D:\WORKSPACE\ZiQi\.superpowers\brainstorm\visual-session\content\layout-options.html
```

Example fragment:

```html
<h2>Workbench Layout Options</h2>
<p class="subtitle">Compare the possible focused workspace layouts.</p>

<div class="cards">
  <div class="card">
    <div class="card-body">
      <h3>Option A</h3>
      <p>Single focused spectrum workspace.</p>
    </div>
  </div>
  <div class="card">
    <div class="card-body">
      <h3>Option B</h3>
      <p>Workspace with grouped controls above the waveform.</p>
    </div>
  </div>
</div>
```

Use fragments, not full HTML documents. The Node REPL server supplies the page shell and shared CSS.

## Step 3: Start the Node REPL HTTP Server

Run this in `node_repl`.

Set `globalThis.ziqiBrainstormContentPath` to the first fragment you want to show:

```js
var http = await import("node:http");
var fs = await import("node:fs/promises");

if (globalThis.ziqiBrainstormServer) {
  await new Promise((resolve) => globalThis.ziqiBrainstormServer.close(resolve));
}

globalThis.ziqiBrainstormContentPath =
  "D:/WORKSPACE/ZiQi/.superpowers/brainstorm/visual-session/content/layout-options.html";

globalThis.ziqiBrainstormServer = http.createServer(async (req, res) => {
  try {
    const fragment = await fs.readFile(globalThis.ziqiBrainstormContentPath, "utf8");
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ZiQi Brainstorm</title>
  <style>
    body {
      margin: 0;
      background: #f3efe8;
      color: #1f1a17;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.5;
    }

    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px;
    }

    h2 {
      margin: 0 0 6px;
      font-size: 28px;
    }

    .subtitle {
      color: #6e6256;
      margin: 0 0 24px;
    }

    .mockup,
    .option,
    .card {
      border: 1px solid #d1b997;
      background: #fffaf3;
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(94, 63, 31, 0.08);
    }

    .mockup {
      margin-bottom: 24px;
      overflow: hidden;
    }

    .mockup-header {
      padding: 10px 14px;
      border-bottom: 1px solid #e4d6c3;
      color: #6e6256;
      font-weight: 700;
    }

    .mockup-body,
    .card-body {
      padding: 14px;
    }

    .label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #b96a30;
      font-weight: 700;
    }

    .mock-button {
      border: 1px solid #cdbda7;
      background: #fff7ef;
      border-radius: 999px;
      padding: 6px 10px;
      color: #8a5427;
    }

    .options,
    .cards {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .option,
    .card {
      cursor: pointer;
      overflow: hidden;
    }

    .option {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 10px;
      padding: 14px;
    }

    .option:hover,
    .card:hover {
      outline: 2px solid #b96a30;
    }

    .option.selected,
    .card.selected {
      background: #fff1df;
      outline: 3px solid #b96a30;
    }

    .letter {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #b96a30;
      color: #fff;
      font-weight: 800;
    }

    @media (max-width: 900px) {
      .options,
      .cards {
        grid-template-columns: 1fr;
      }

      main {
        padding: 18px;
      }
    }
  </style>
</head>
<body>
  <main>${fragment}</main>
  <script>
    document.querySelectorAll(".option,.card").forEach((element) => {
      element.addEventListener("click", () => {
        if (!element.parentElement?.hasAttribute("data-multiselect")) {
          document.querySelectorAll(".option,.card").forEach((item) => {
            item.classList.remove("selected");
          });
        }
        element.classList.toggle("selected");
      });
    });
  </script>
</body>
</html>`;

    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0"
    });
    res.end(html);
  } catch (err) {
    res.writeHead(500, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(String(err?.stack || err));
  }
});

await new Promise((resolve) => {
  globalThis.ziqiBrainstormServer.listen(63888, "127.0.0.1", resolve);
});

nodeRepl.write("http://localhost:63888");
```

## Step 4: Verify the Server Before Sharing

Run:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:63888' -TimeoutSec 5
```

Expected result:

```text
StatusCode: 200
```

Only share the URL after this succeeds.

## Step 5: Open the In-App Browser

Use:

```text
http://localhost:63888
```

Ask the user to refresh the page after each screen update if the browser does not update immediately.

## Step 6: Switch Visual Screens

Write the next fragment to the same session directory, for example:

```text
D:\WORKSPACE\ZiQi\.superpowers\brainstorm\visual-session\content\control-zone-options.html
```

Then run this in `node_repl`:

```js
globalThis.ziqiBrainstormContentPath =
  "D:/WORKSPACE/ZiQi/.superpowers/brainstorm/visual-session/content/control-zone-options.html";

nodeRepl.write("screen updated");
```

The HTTP server reads `globalThis.ziqiBrainstormContentPath` on every request, so changing this value is enough to switch screens.

## Step 7: Verify the Screen Updated

After switching screens, verify the returned HTML includes the expected title:

```powershell
$uri = 'http://localhost:63888?check=' + (Get-Random)
$content = (Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 5).Content
if ($content -match '<h2>(.*?)</h2>') { $Matches[1] } else { 'no h2' }
```

Expected result: the printed `<h2>` text should match the new fragment.

## Step 8: Stop or Replace the Server

To stop the server in `node_repl`:

```js
if (globalThis.ziqiBrainstormServer) {
  await new Promise((resolve) => globalThis.ziqiBrainstormServer.close(resolve));
  globalThis.ziqiBrainstormServer = null;
}
```

To replace the server, run the start script from Step 3 again. It closes any existing `globalThis.ziqiBrainstormServer` before creating a new one.

## Checklist

Before telling the user the visual companion is ready:

- HTML fragment exists under `.superpowers/brainstorm/<session>/content/`.
- Node REPL server is listening on `127.0.0.1:63888`.
- `Invoke-WebRequest` returns `200`.
- The returned `<h2>` matches the intended screen.
- Browser URL is `http://localhost:63888`.

## Notes

- Keep visual mockups in `.superpowers/brainstorm/`; do not commit them.
- Use official docs/spec/plan files for durable decisions.
- The `cache-control: no-store` response header is important. Keep it in the server code so browser refreshes do not show stale screens.
