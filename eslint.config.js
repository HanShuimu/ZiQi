import js from "@eslint/js";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const rawBusinessControlTags = new Set(["button", "input", "select", "textarea"]);

const architecturePlugin = {
  rules: {
    "no-raw-business-controls": {
      meta: {
        type: "problem",
        docs: {
          description: "Require business UI to use ui primitives for form controls."
        },
        messages: {
          rawBusinessControl:
            "Business UI must use ui primitives instead of raw form controls."
        },
        schema: []
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            const importer = toProjectPath(context.filename);

            if (
              !importer ||
              isTestFile(importer) ||
              importer.startsWith("src/ui/") ||
              importer.startsWith("src/skins/")
            ) {
              return;
            }

            if (
              node.name.type === "JSXIdentifier" &&
              rawBusinessControlTags.has(node.name.name)
            ) {
              context.report({ node, messageId: "rawBusinessControl" });
            }
          }
        };
      }
    },
    "no-cross-feature-imports": {
      meta: {
        type: "problem",
        docs: {
          description: "Prevent concrete features from importing other concrete features."
        },
        messages: {
          crossFeature:
            "Features must not import other concrete features. Move shared code to core, services, capabilities, app/session, or ui."
        },
        schema: []
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const importer = toProjectPath(context.filename);
            const imported = resolveImportPath(importer, node.source.value);

            if (!imported || isTestFile(importer)) {
              return;
            }

            const importerFeature = getFeatureName(importer);
            const importedFeature = getFeatureName(imported);

            if (
              importerFeature &&
              importedFeature &&
              importerFeature !== importedFeature
            ) {
              context.report({ node, messageId: "crossFeature" });
            }
          }
        };
      }
    },
    "no-business-skin-imports": {
      meta: {
        type: "problem",
        docs: {
          description: "Keep concrete skins behind ui and skin registry boundaries."
        },
        messages: {
          concreteSkin:
            "Business modules must not import concrete skins or skin libraries directly. Use ui primitives or an approved skin-switching boundary."
        },
        schema: []
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const importer = toProjectPath(context.filename);
            const source = node.source.value;
            const imported = resolveImportPath(importer, source);

            if (isTestFile(importer) || isAllowedSkinImporter(importer)) {
              return;
            }

            if (
              source === "animal-island-ui" ||
              source === "animal-island-ui/style" ||
              imported?.startsWith("src/skins/")
            ) {
              context.report({ node, messageId: "concreteSkin" });
            }
          }
        };
      }
    }
  }
};

export default tseslint.config(
  {
    ignores: [
    "**/.worktrees/**",
    "**/dist/**",
    "**/dist-electron/**",
    "**/node_modules/**"
  ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["*.{js,mjs}", "eslint.config.test.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    }
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },
    plugins: {
      architecture: architecturePlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "architecture/no-business-skin-imports": "error",
      "architecture/no-cross-feature-imports": "error",
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true
        }
      ]
    }
  },
  {
    files: [
      "src/App.tsx",
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/workspaces/**/*.{ts,tsx}"
    ],
    ignores: ["src/**/*.test.{ts,tsx}", "src/ui/**", "src/skins/**"],
    rules: {
      "architecture/no-raw-business-controls": "error"
    }
  },
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "window",
          message: "Core must not depend on browser globals."
        },
        {
          name: "document",
          message: "Core must not depend on DOM globals."
        },
        {
          name: "AudioContext",
          message: "Core must not depend on Web Audio runtime APIs."
        },
        {
          name: "HTMLAudioElement",
          message: "Core must not depend on DOM media elements."
        },
        {
          name: "localStorage",
          message: "Core must not depend on browser storage."
        }
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "Core must stay independent from React."
            },
            {
              name: "react-dom",
              message: "Core must stay independent from React DOM."
            },
            {
              name: "electron",
              message: "Core must stay independent from Electron."
            },
            {
              name: "animal-island-ui",
              message: "Core must stay independent from concrete UI libraries."
            }
          ],
          patterns: [
            {
              group: [
                "../app/*",
                "../../app/*",
                "../capabilities/*",
                "../../capabilities/*",
                "../components/*",
                "../../components/*",
                "../features/*",
                "../../features/*",
                "../services/*",
                "../../services/*",
                "../skins/*",
                "../../skins/*",
                "../ui/*",
                "../../ui/*",
                "../workspaces/*",
                "../../workspaces/*"
              ],
              message:
                "Core may not import app, services, capabilities, features, workspaces, ui, skins, or legacy components."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "Services must not import React."
            }
          ],
          patterns: [
            {
              group: [
                "../app/*",
                "../../app/*",
                "../features/*",
                "../../features/*",
                "../workspaces/*",
                "../../workspaces/*"
              ],
              message:
                "Services may not import app composition, concrete features, or workspaces."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/capabilities/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../features/*",
                "../../features/*",
                "../workspaces/*",
                "../../workspaces/*"
              ],
              message: "Capabilities may not import concrete features or workspaces."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["electron/**/*.{ts,cts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "no-control-regex": "off"
    }
  },
  {
    files: ["src/App.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^(is[A-Z])"
        }
      ]
    }
  },
  {
    files: ["src/ui/types.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "warn"
    }
  },
  {
    files: ["src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/refs": "warn"
    }
  },
  {
    files: ["src/features/spectrogramViewer/SpectrogramView.tsx", "src/components/WorkbenchShell.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["../components/*", "../../components/*"],
          message: "App composition may not import legacy components directly."
        }]
      }]
    }
  },
  {
    files: ["src/workspaces/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["../components/*", "../../components/*", "../skins/*", "../../skins/*"],
          message: "Workspaces may only import features, capabilities, core, services, ui, and app/session."
        }]
      }]
    }
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["../components/*", "../../components/*"],
          message: "Features must not import legacy components. Move shared code elsewhere."
        }]
      }]
    }
  },
  {
    files: ["src/skins/**/adapter.tsx"],
    rules: {
      "react-refresh/only-export-components": "off"
    }
  },
  {
    files: ["electron/platform/**/*.{ts,cts}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["../../src/*", "../src/*"],
          message: "Electron platform modules must not import renderer source files."
        }]
      }]
    }
  },
);

function toProjectPath(filePath) {
  if (!filePath || filePath === "<text>") {
    return "";
  }

  const normalized = normalizePath(filePath);
  const srcIndex = normalized.lastIndexOf("/src/");
  if (srcIndex >= 0) {
    return normalized.slice(srcIndex + 1);
  }

  const electronIndex = normalized.lastIndexOf("/electron/");
  if (electronIndex >= 0) {
    return normalized.slice(electronIndex + 1);
  }

  return normalizePath(path.relative(workspaceRoot, filePath));
}

function resolveImportPath(importer, source) {
  if (typeof source !== "string" || !source.startsWith(".") || !importer) {
    return null;
  }

  const absoluteImporter = path.join(workspaceRoot, importer);
  const resolved = path.resolve(path.dirname(absoluteImporter), source);
  return normalizePath(path.relative(workspaceRoot, resolved));
}

function getFeatureName(projectPath) {
  const match = projectPath.match(/^src\/features\/([^/]+)/);
  return match?.[1] ?? null;
}

function isAllowedSkinImporter(projectPath) {
  return (
    projectPath === "src/main.tsx" ||
    projectPath === "src/App.tsx" ||
    projectPath.startsWith("src/skins/") ||
    projectPath.startsWith("src/ui/") ||
    projectPath.startsWith("src/app/skin") ||
    projectPath.startsWith("src/features/skinSwitcher/")
  );
}

function isTestFile(projectPath) {
  return /\.test\.[cm]?[jt]sx?$/.test(projectPath);
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}
