// 权限只读预览共享层：加载 hook + 三处预览的公共展示块。
// 新增预览形态（如岗位/租户）优先复用此处，禁止再复制菜单树/成员采样模板。
export { PREVIEW_TREE_PROPS, usePermissionPreview } from "./src/hook";
export { default as PreviewMenuTree } from "./src/PreviewMenuTree.vue";
export { default as PreviewUsersTable } from "./src/PreviewUsersTable.vue";
