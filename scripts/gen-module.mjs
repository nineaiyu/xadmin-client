#!/usr/bin/env node
// 客户端模块脚手架：生成页面薄壳 + API 占位模块 + 待合并的 locale / 菜单片段。
//
// 用法：
//   pnpm gen:module <module> [page]        # page 省略时默认与 module 同名
//   pnpm gen:module crm customer --force   # 覆盖已存在的目标文件
//   node scripts/gen-module.mjs --self-test # 临时目录自检（不引入新依赖）
//
// 口径：
// - 只生成「薄壳」：页面不写假业务接口，API 模块只保留集中的路径常量和继承
//   BaseApi 的占位类，真实字段/动作按后端元数据协议接入；
// - scaffold/<module>/ 下的 locale 与 menu 片段只落盘到该目录，绝不直接改
//   locales/zh-CN.yaml、en.yaml 或后端 seeds/，避免脚手架静默污染词条与权限点；
// - 已存在即失败（防误覆盖），--force 才覆盖。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME_RE = /^[a-z][a-z0-9_-]*$/;

const HELP = `客户端模块脚手架

用法:
  pnpm gen:module <module> [page] [--force]
  node scripts/gen-module.mjs --self-test

参数:
  module       模块目录名（小写字母开头，可含数字、-、_）
  page         页面目录名；省略时取 module
  --force      覆盖已存在的目标文件
  --self-test  在临时目录生成一次并校验（不写仓库）
  -h, --help   显示本帮助

输出:
  src/views/<module>/<page>/index.vue
  src/api/<module>/<page>.ts
  scaffold/<module>/locales.zh.yaml
  scaffold/<module>/locales.en.yaml
  scaffold/<module>/menu.json
`;

const pascal = value =>
  value
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join("");

const camel = value => {
  const result = pascal(value);
  return result[0].toLowerCase() + result.slice(1);
};

function parseArgs(argv) {
  const flags = new Set(argv.filter(item => item.startsWith("-")));
  const positional = argv.filter(item => !item.startsWith("-"));
  return { flags, positional };
}

function buildNames(module, page) {
  const pageName = page ?? module;
  if (!NAME_RE.test(module)) {
    throw new Error(`module 命名不合法：${module}（要求 ${NAME_RE}）`);
  }
  if (!NAME_RE.test(pageName)) {
    throw new Error(`page 命名不合法：${pageName}（要求 ${NAME_RE}）`);
  }
  const component = pascal(module) + pascal(pageName);
  const localeName = camel(module) + pascal(pageName);
  const apiConst =
    `${module}_${pageName}`.replace(/-/g, "_").toUpperCase() + "_API";
  const apiInstance = camel(module) + pascal(pageName) + "Api";
  const apiPath = `/api/${module}/${pageName}`;
  return {
    module,
    pageName,
    component,
    localeName,
    apiConst,
    apiInstance,
    apiPath
  };
}

function viewTemplate(names) {
  return `<script lang="ts" setup>
import RePage from "@/components/RePage";

defineOptions({
  name: "${names.component}" // 必须定义，用于菜单自动匹配组件
});

// 下一步接线（脚手架故意不生成假业务接口）：
// 1. 后端：ViewSet 混入 SearchFieldsAction / SearchColumnsAction 并声明 table_fields，
//    路由前缀与 src/api/${names.apiPath.replace(/^\/api\//, "")}.ts 中的 ${names.apiConst} 保持一致；
// 2. 前端：页面稳定后把 RePage 换成 RePlusPage，:api 传 ${names.apiInstance}，按权限点补 :auth；
// 3. 菜单：把 scaffold 下的 menu.json 片段合并进后端 <app>/seeds/menu.json + menumeta.json；
// 4. 词条：把 scaffold 下的 locales.zh.yaml / locales.en.yaml 合并进 locales 对应文件。
</script>

<template>
  <RePage>
    <el-empty description="${names.component} 页面待接线" />
  </RePage>
</template>
`;
}

function apiTemplate(names) {
  const apiFile = `${names.module}/${names.pageName}`;
  return `import { BaseApi } from "@/api/base";

/** ${names.component} 接口基地址：只在这里改路径，页面不要散落 URL 字面量 */
export const ${names.apiConst} = "${names.apiPath}";

class ${pascal(names.apiInstance)} extends BaseApi {}

/**
 * ${names.component} 占位 API：继承 BaseApi 的列表/详情/增改删与元数据方法。
 * 下一步按后端真实契约补业务方法（动作路径统一拼 ${names.apiConst}），
 * 后端接口登记见 xadmin-server/<app>/seeds/menu.json 的权限点。
 */
export const ${names.apiInstance} = new ${pascal(names.apiInstance)}(${names.apiConst});
// 生成文件：src/api/${apiFile}.ts
`;
}

function localeZh(names) {
  return `${names.localeName}:
  title: ${names.component}
  pending: ${names.component} 页面待接线
`;
}

function localeEn(names) {
  return `${names.localeName}:
  title: ${names.component}
  pending: ${names.component} page is not wired yet
`;
}

function menuFragment(names) {
  const menuPk = randomUUID();
  const metaPk = randomUUID();
  return `${JSON.stringify(
    {
      _instruction:
        "把 menus 合并进后端 <app>/seeds/menu.json，permission_points 合并进 <app>/seeds/menumeta.json（或按 sync_menu_permissions --update-seed 回写）；pk / parent / meta 需替换为库中真实值。",
      menus: [
        {
          model: "system.menu",
          pk: menuPk,
          fields: {
            parent: null,
            menu_type: 1,
            name: names.component,
            rank: 9999,
            path: `/${names.apiPath.replace(/^\/api\//, "")}/index`,
            component: `${names.apiPath.replace(/^\/api\//, "")}/index`,
            is_active: true,
            meta: metaPk,
            method: "",
            model: []
          }
        }
      ],
      permission_points: [
        {
          name: `list:${names.component}`,
          path: `api/${names.apiPath.replace(/^\/api\//, "")}$`,
          method: "GET",
          menu: menuPk
        }
      ]
    },
    null,
    2
  )}\n`;
}

function plannedFiles(root, module, page, names) {
  return [
    {
      file: path.join(root, "src", "views", module, page, "index.vue"),
      content: viewTemplate(names)
    },
    {
      file: path.join(root, "src", "api", module, `${page}.ts`),
      content: apiTemplate(names)
    },
    {
      file: path.join(root, "scaffold", module, "locales.zh.yaml"),
      content: localeZh(names)
    },
    {
      file: path.join(root, "scaffold", module, "locales.en.yaml"),
      content: localeEn(names)
    },
    {
      file: path.join(root, "scaffold", module, "menu.json"),
      content: menuFragment(names)
    }
  ];
}

async function generate(root, module, page, { force = false } = {}) {
  const names = buildNames(module, page);
  const files = plannedFiles(root, module, page, names);
  const existing = files.filter(item => existsSync(item.file));
  if (existing.length && !force) {
    const list = existing
      .map(item => path.relative(root, item.file))
      .join("\n  ");
    throw new Error(`目标已存在，拒绝覆盖（确认后加 --force）：\n  ${list}`);
  }
  for (const item of files) {
    await mkdir(path.dirname(item.file), { recursive: true });
    await writeFile(item.file, item.content, "utf-8");
  }
  return { names, files };
}

function printNextSteps(module, names) {
  const prefix = path.join("src", "views", module);
  console.log(`
已生成：
  ${path.join(prefix, names.pageName, "index.vue")}
  ${path.join("src", "api", module, `${names.pageName}.ts`)}
  ${path.join("scaffold", module, "locales.zh.yaml")}
  ${path.join("scaffold", module, "locales.en.yaml")}
  ${path.join("scaffold", module, "menu.json")}

下一步（复制到这些文件）：
  1) scaffold/${module}/locales.zh.yaml -> locales/zh-CN.yaml（顶层键 ${names.localeName}，en 同理）
  2) scaffold/${module}/menu.json 的 menus -> xadmin-server/<app>/seeds/menu.json
     permission_points -> xadmin-server/<app>/seeds/menumeta.json
  3) 后端执行：python manage.py sync_menu_permissions --update-seed
     再用 --dry-run 确认缺口 0 条
  4) 页面接线步骤见 src/views/${module}/${names.pageName}/index.vue 顶部注释
`);
}

async function selfTest() {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "xadmin-gen-module-"));
  try {
    const { files } = await generate(tmpRoot, "crm", "customer");
    for (const item of files) {
      const text = await readFile(item.file, "utf-8");
      if (!text.trim()) throw new Error(`自检失败，文件为空：${item.file}`);
    }
    const view = await readFile(files[0].file, "utf-8");
    if (!view.includes('name: "CrmCustomer"')) {
      throw new Error("自检失败：页面缺少 defineOptions name");
    }
    const api = await readFile(files[1].file, "utf-8");
    if (!api.includes('"/api/crm/customer"')) {
      throw new Error("自检失败：API 模块缺少路径常量");
    }
    const menu = JSON.parse(await readFile(files[4].file, "utf-8"));
    if (menu.menus?.[0]?.fields?.component !== "crm/customer/index") {
      throw new Error("自检失败：menu.json 片段结构不正确");
    }
    let idempotent = false;
    try {
      await generate(tmpRoot, "crm", "customer");
    } catch {
      idempotent = true;
    }
    if (!idempotent) throw new Error("自检失败：已存在文件未被拒绝");
    console.log(
      `[ok] gen-module 自检通过（${files.length} 个文件，临时目录已清理）`
    );
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

const { flags, positional } = parseArgs(process.argv.slice(2));
if (flags.has("--help") || flags.has("-h") || flags.has("-help")) {
  console.log(HELP);
  process.exit(0);
}

if (flags.has("--self-test")) {
  selfTest().catch(error => {
    console.error(`[fail] ${error.message}`);
    process.exit(1);
  });
} else {
  const [module, page] = positional;
  if (!module) {
    console.error(HELP);
    process.exit(1);
  }
  generate(ROOT, module, page, { force: flags.has("--force") })
    .then(({ names }) => printNextSteps(module, names))
    .catch(error => {
      console.error(`[fail] ${error.message}`);
      process.exit(1);
    });
}
