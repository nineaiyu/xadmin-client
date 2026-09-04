import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import * as parserVue from "vue-eslint-parser";
import configPrettier from "eslint-config-prettier";
import pluginPrettier from "eslint-plugin-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";

export default defineConfig([
  globalIgnores([
    "**/.*",
    "dist/*",
    "*.d.ts",
    "public/*",
    "src/assets/**",
    "src/**/iconfont/**"
  ]),
  {
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        // types/index.d.ts
        RefType: "readonly",
        EmitType: "readonly",
        TargetContext: "readonly",
        ComponentRef: "readonly",
        ElRef: "readonly",
        ForDataType: "readonly",
        AnyFunction: "readonly",
        PropType: "readonly",
        Writable: "readonly",
        Nullable: "readonly",
        NonNullable: "readonly",
        Recordable: "readonly",
        ReadonlyRecordable: "readonly",
        Indexable: "readonly",
        DeepPartial: "readonly",
        Without: "readonly",
        Exclusive: "readonly",
        TimeoutHandle: "readonly",
        IntervalHandle: "readonly",
        Effect: "readonly",
        ChangeEvent: "readonly",
        WheelEvent: "readonly",
        ImportMetaEnv: "readonly",
        Fn: "readonly",
        PromiseFn: "readonly",
        ComponentElRef: "readonly",
        parseInt: "readonly",
        parseFloat: "readonly"
      }
    },
    plugins: {
      prettier: pluginPrettier
    },
    rules: {
      ...configPrettier.rules,
      ...pluginPrettier.configs.recommended.rules,
      "no-debugger": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto"
        }
      ]
    }
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["**/*.?([cm])ts", "**/*.?([cm])tsx"]
  })),
  {
    files: ["**/*.?([cm])ts", "**/*.?([cm])tsx"],
    rules: {
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-unsafe-function-type": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false, fixStyle: "inline-type-imports" }
      ],
      "@typescript-eslint/prefer-literal-enum-member": [
        "error",
        { allowBitwiseExpressions: true }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
  {
    files: ["**/*.?([cm])js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      globals: {
        $: "readonly",
        $$: "readonly",
        $computed: "readonly",
        $customRef: "readonly",
        $ref: "readonly",
        $shallowRef: "readonly",
        $toRef: "readonly"
      },
      parser: parserVue,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: [".vue"],
        parser: tseslint.parser,
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      vue: pluginVue
    },
    processor: pluginVue.processors[".vue"],
    rules: {
      ...pluginVue.configs.base.rules,
      ...pluginVue.configs.essential.rules,
      ...pluginVue.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "warn",
      "vue/no-v-html": "off",
      "vue/require-default-prop": "off",
      "vue/require-explicit-emits": "off",
      "vue/multi-word-component-names": "off",
      "vue/no-setup-props-reactivity-loss": "off",
      "vue/html-self-closing": [
        "error",
        {
          html: {
            void: "always",
            normal: "always",
            component: "always"
          },
          svg: "always",
          math: "always"
        }
      ]
    }
  },
  {
    // any 存量豁免清单：这些文件暂时关闭 no-explicit-any（CI lint 带 --max-warnings 0）。
    // 治理策略：新增代码不允许 any（默认 warn + max-warnings 0 强制）；
    // 存量文件每清零一个，就从本清单移除一行，最终删除本块。
    files: [
      "src/api/auth.ts",
      "src/api/types.ts",
      "src/components/ReDialog/index.ts",
      "src/components/ReDialog/type.ts",
      "src/components/ReDrawer/index.ts",
      "src/components/ReDrawer/type.ts",
      "src/components/RePlusPage/src/components/ButtonOperation/src/types.ts",
      "src/components/RePlusSearch/src/hooks.ts",
      "src/components/ReQrcode/src/index.tsx",
      "src/components/ReSeamlessScroll/src/utils.ts",
      "src/router/index.ts",
      "src/router/utils.ts",
      "src/store/modules/permission.ts",
      "src/utils/http/index.spec.ts",
      "src/utils/index.ts",
      "src/utils/websocket.ts",
      "src/views/demo/book/utils/hook.tsx",
      "src/views/system/config/user/utils/hook.tsx",
      "src/views/system/dept/utils/hook.tsx",
      "src/views/system/hooks.tsx",
      "src/views/system/logs/login/utils/hook.tsx",
      "src/views/system/logs/operation/utils/hook.tsx",
      "src/views/system/menu/utils/hook.tsx",
      "src/views/system/menu/utils/types.ts",
      "src/views/system/notice/read/hook.tsx",
      "src/views/system/notice/utils/hook.tsx",
      "src/views/system/online/utils/hook.tsx",
      "src/views/system/permission/components/utils/hook.tsx",
      "src/views/system/permission/components/utils/types.ts",
      "src/views/user/info/utils/types.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["**/*.vue", "**/*.tsx"],
    plugins: {
      "better-tailwindcss": eslintPluginBetterTailwindcss
    },
    rules: {
      "better-tailwindcss/enforce-consistent-variable-syntax": "warn",
      "better-tailwindcss/enforce-canonical-classes": "warn"
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/style/tailwind.css",
        rootFontSize: 16
      }
    }
  }
]);
