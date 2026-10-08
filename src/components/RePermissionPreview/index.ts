// 权限只读预览共享层：加载 hook + 各预览的公共展示块。
// 新增预览形态（如岗位/租户）优先复用此处，禁止再复制菜单树/成员采样模板。
export { PREVIEW_TREE_PROPS, usePermissionPreview } from "./src/hook";
export {
  toFieldMatrixEntries,
  type FieldMatrixEntry,
  type FieldMatrixModel
} from "./src/fieldMatrix";
export { default as PreviewDescriptions } from "./src/PreviewDescriptions.vue";
export { default as PreviewFieldMatrix } from "./src/PreviewFieldMatrix.vue";
export { default as PreviewMenuTree } from "./src/PreviewMenuTree.vue";
export { default as PreviewNotes } from "./src/PreviewNotes.vue";
export { default as PreviewRuleGroupTable } from "./src/PreviewRuleGroupTable.vue";
export { default as RePermissionPreviewShell } from "./src/PreviewShell.vue";
export { default as PreviewStatusTag } from "./src/PreviewStatusTag.vue";
export { default as PreviewUsersTable } from "./src/PreviewUsersTable.vue";
