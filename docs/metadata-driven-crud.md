# 元数据驱动 CRUD 前端方案：复用说明

> 本方案（`RePlusPage` + `contract/schema`）不是通用组件库，而是「后端下发列/表单元数据、前端只注册渲染器」的
> CRUD 页面生成方案。本文说明把它搬到别的项目需要满足什么、需要搬哪些文件、以及哪些部分与 xadmin 强耦合。

## 一、方案是什么

一条列表页的列、搜索项、表单域**不在前端硬编码**，而是页面挂载时向资源端点取两份元数据：

| 端点                           | 作用                                                 | 契约                                                                                        |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET {baseApi}/search-columns` | 表格列定义（字段、label、`input_type`、排序/宽度等） | [contract/schema/search-columns.schema.json](../contract/schema/search-columns.schema.json) |
| `GET {baseApi}/search-fields`  | 搜索区 + 新增/编辑表单定义                           | [contract/schema/search-fields.schema.json](../contract/schema/search-fields.schema.json)   |

前端把 `input_type` 映射到渲染器（搜索组件 / 表单控件 / 单元格渲染），映射表是**模块级全局注册表**，
业务侧可注册自定义 `input_type` 或覆盖内置行为（`registerSearchRenderer` / `registerFormRenderer` /
`registerDetailRenderer`）。契约由 `contract/schema` 镜像服务端 `docs/schema`，`pnpm gen:metadata-types`
生成 TS 类型（见 [../README.md](../README.md) 门禁清单）。

配套能力（同一份元数据驱动）：新增/编辑弹窗、详情抽屉、导入导出、回收站、变更历史、操作列按钮，
均按 `auth` 传入的权限布尔量显隐。

## 二、最小依赖集（移植清单）

### 必需

| 项            | 路径                                                        | 说明                                                   |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 页面组件      | `src/components/RePlusPage/`（整目录）                      | 含 `src/utils/` 的取数、列构建、渲染器注册表、按钮体系 |
| 表格底座      | `@pureadmin/table`（`PureTable` / `PureTableBar`）          | `RePlusPage` 直接依赖，非可选项                        |
| 搜索/表单底座 | `plus-pro-components`（`PlusSearch` / `PlusColumn`）        | 元数据 → 表单项的转换层                                |
| 请求层        | `src/utils/http/`（`http.request` 封装）                    | `BaseApi` 依赖；需保留统一响应壳与拦截器约定           |
| 契约与类型    | `contract/schema/*.json` + `scripts/gen-metadata-types.mjs` | 保证元数据字段名/类型不漂移                            |
| 权限判定      | 一个 `hasAuth(code)` 实现                                   | 页面用 `hasAuth("动作:组件名")` 组装 `auth` 对象传入   |

### 可选（按需）

| 项                                             | 说明                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/components/ReIcon/`                       | 操作按钮/表头图标（也可换成自己的图标方案）                                                                 |
| `src/utils/dict.ts` + `/api/system/dict/items` | 字典驱动的选项与状态标签；不接字典时 `input_type` 走静态 `choices`                                          |
| `src/utils/form.ts`                            | 含文件的表单按 FormData 协议 v1 展开（`ADR-007`）                                                           |
| i18n                                           | 列 label 走 `{localeName}.{key}` → `commonLabels` → 后端 label 回退链路；无 i18n 时退化为直接显示后端 label |

## 三、后端需要提供什么

1. **两个元数据端点**（`search-columns` / `search-fields`），响应体符合 `contract/schema`；
2. **统一响应壳**：列表/详情等接口的成功响应形如 `{ code: 1000, data: { results, ... } }`，
   前端 `listRows()` 是唯一拆包点；
3. **权限码约定**：`{动作}:{组件名}`（如 `list:SystemUser`），前端页面把同一批 code 交给 `hasAuth` 组装
   `auth`，后端按同一批 code 做接口鉴权——**两边字符串必须一字不差**；
4. **列表查询参数**：分页 + 排序 + 搜索字段的键名与 `search-fields` 声明一致。

## 四、移植步骤

1. 拷 `src/components/RePlusPage/` 与 `src/utils/http/`，对齐 `@pureadmin/table` / `plus-pro-components` 版本；
2. 拷 `contract/schema/` 并跑一次 `node scripts/gen-metadata-types.mjs`（或按自己的构建链路接上）；
3. 后端按 §三 实现两个元数据端点 + 统一响应壳；
4. 写页面：`defineOptions({ name: "Xxx" })` → `const { ... } = usePlusPage({ api, auth, localeName })` →
   模板挂 `<RePlusPage v-bind="..." />`，权限布尔量由 `hasAuth` 组装。

## 五、边界与已知耦合

- **`auth` 是显式传入的布尔量集合**（`list` / `retrieve` / `create` / `update` / `partialUpdate` / `destroy` /
  `exportData` / `importData` / `changeHistory` / `recycleList`），不做请求拦截式的隐式鉴权；
- **渲染器注册是模块级全局的**：注册必须早于页面首渲染，注册晚于首渲染会导致该 `input_type` 静默回退到默认渲染
  （开发期已有显式告警，见 `docs/dev-pitfalls.md` 前端渲染条目）；
- **元数据缺失是静默失败的最大来源**：后端漏配 `search-columns` 时页面表现为「表格空列」而非报错，
  DEV 环境已有警示条（请求完成后 1.5s 仍无元数据即提示）；
- **契约变更需三方同步**：服务端 `docs/schema` → 前端 `contract/schema` 镜像 → 生成类型，
  本仓库用 `pnpm sync:contract` 一键完成镜像与再生成，CI 用 `check:contract` 防绕过；
- 本方案覆盖「标准 CRUD 列表页」；非列表形态（看板、画布、聊天等）不适用。

## 六、相关文档

| 文档                                                                                                                 | 内容                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md)                                                                             | 分支模型、commitlint、提交前门禁                                        |
| [../README.md](../README.md)                                                                                         | 环境要求、默认代理、环境变量、门禁清单、FAQ                             |
| [xadmin-server/docs/architecture/metadata-protocol.md](../../xadmin-server/docs/architecture/metadata-protocol.md)   | 元数据协议规范：字段语义、`input_type` 推断链与注册表、与字段权限的关系 |
| [xadmin-server/docs/architecture/framework-cookbook.md](../../xadmin-server/docs/architecture/framework-cookbook.md) | RePlusPage props/emits/expose 契约、ViewSet 选型、覆写点                |
