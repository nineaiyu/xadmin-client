# src/extensions/ —— 二开页面扩展区

> 二开（含插件）的前端页面放这里，不污染 `src/views/`。
> 路由是**菜单驱动**的：本目录已被动态路由 glob 覆盖
> （`src/router/utils/async-routes.ts` 的 `import.meta.glob` 同时扫
> `/src/views/**` 与 `/src/extensions/**`），**新增页面不需要改任何前端路由文件**。

## 接线三步（以 demo-plugin 为例）

活示例：`src/extensions/demo-plugin/`（配套后端插件
`xadmin-server/examples/plugins/xadmin-demo-plugin`）。

1. **写页面组件**：`extensions/<module>/index.vue`。
   `defineOptions({ name })` 是路由匹配键，**必须定义且与后端菜单种子的
   `name` 一致**（也是权限点 `<动作>:<组件名>` 的后缀）——改名即断路由，
   且无编译期报错（守护门禁：`pnpm check:menu-components`）。
2. **登记菜单种子（后端）**：在所属应用 / 插件包的 `seeds/menu.json` 写
   页面菜单（`menu_type=1`、`component="extensions/<module>/index"`）与
   权限点（`menu_type=2`、`name="<动作>:<组件名>"`）。`component` 片段以
   `extensions/` 开头时由 `resolve-component.ts` 定位到本目录（见其候选链）。
3. **灌种子**：宿主侧 `python manage.py load_init_json`（应用需在
   `XADMIN_APPS` 中，插件同理——装了才收集，未装不残留菜单）。

## 约定与边界

- 页面形态与 `views/` 完全同构：列表页用 `RePlusPage`（列 / 表单 / 按钮可全部
  来自后端元数据，见 demo-plugin 的最小形态），API 走 `BaseApi` 家族。
- 词条照常登记 `locales/{zh-CN,en}.yaml`（zh/en 对称，`pnpm check:i18n` 会拦）。
- 菜单种子引用的每个 `component` 都必须能在本目录或 `views/` 解析到真实文件
  （`pnpm check:menu-components`，与后端 `sync_menu_permissions --dry-run`
  的「缺口 0 条」共同构成断链守护）。
- 插件页面的存活周期跟随插件：插件卸载后请同步移除对应 extensions 页面，
  避免种子已删、页面残留的孤儿组件。
