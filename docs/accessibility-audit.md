# 可访问性（a11y）审计：菜单与表单（N2）

> 审计日期：2026-09-08。范围：登录链路 + 全局导航（顶栏/侧栏）+ 表单输入的可访问性。
> 方法：键盘走查（Tab/Enter/Space）+ 屏幕阅读器语义核对（role/aria-label/label 关联）+ 源码静态排查。

## 一、已修复

| #   | 位置                                 | 问题                                                           | 修复                                                                                  |
| --- | ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | `SidebarTopCollapse.vue` 折叠按钮    | `div` 纯点击目标：无 role/tabindex，键盘完全不可达，读屏无名称 | `role="button"` + `tabindex="0"` + `aria-label`（随展开态切换文案）+ Enter/Space 触发 |
| 2   | `SidebarFullScreen.vue` 全屏切换     | `span` 无任何可访问名称（连 title 都没有）                     | 补 `title` + `role="button"` + `tabindex="0"` + `aria-label` + 键盘触发               |
| 3   | 顶栏「项目配置」齿轮（`lay-navbar`） | 有 title 但无 role/tabindex，读屏读不出用途                    | `role="button"` + `tabindex="0"` + `aria-label` + 键盘触发                            |
| 4   | 顶栏语言切换触发器                   | `div` 无名称                                                   | `role="button"` + `tabindex="0"` + `aria-label`（EP dropdown 自带键盘导航）           |
| 5   | 顶栏用户菜单触发器与头像             | 触发器无名称；`img` 无 alt，读屏读出图片地址                   | `aria-label`（用户菜单）+ `:alt="username"`                                           |
| 6   | 顶栏消息通知触发器（`lay-notice`）   | 无名称                                                         | `role="button"` + `aria-label`                                                        |
| 7   | 登录页账号/密码输入框                | 仅有 placeholder（读屏不视作标签）                             | `el-input` 透传 `aria-label`                                                          |

> 备注：曾一并实现「适老模式主题（大字号/高对比）」，因观感不佳已于 2026-09-08 整体回滚（产品决策不做）。

## 二、核对后无需修改

- `el-menu` / `el-dropdown` / `el-dialog` / `el-tabs` 等 Element Plus 组件自带完整 role/aria 语义；
- 面包屑使用 `el-breadcrumb`（nav + ol/li 语义）；
- `RePlusPage` 动态表单经 `el-form-item` 关联 label，无需额外 aria；
- 图标按钮若为 `el-button` + 文案（如表格操作列）有可访问名称。

## 三、待办（滚动，不阻塞 N2 收口）

| #   | 项              | 说明                                                                                          |
| --- | --------------- | --------------------------------------------------------------------------------------------- |
| 1   | 表格数据语义    | `el-table` 数据表的 caption/aria-describedby 缺失，读屏逐格浏览体验一般                       |
| 2   | tabindex 硬编码 | 登录页 `tabindex="100"` 等写死值，插入新控件后顺序易错，建议改为自然顺序                      |
| 3   | 焦点管理        | 弹窗关闭后焦点返回触发器依赖 EP 默认行为，未逐项验证                                          |
| 4   | 自动化门禁      | 建议在 E2E 中接入 axe-core（`@axe-core/playwright`）对登录页 + 系统管理首页做基线扫描，防回归 |
