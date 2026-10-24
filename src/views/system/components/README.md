# system/components 目录边界

本目录只放 **system 域内部**共用的组件（被本域多个页面引用、不被其他域引用）。

## 现存成员

| 组件                                                                      | 域内使用方                         |
| ------------------------------------------------------------------------- | ---------------------------------- |
| `BatchUpdateForm.vue` / `useBatchUpdate.tsx` / `useActiveBatchUpdate.tsx` | 用户管理等批量更新弹层             |
| `MemberTagEditor.vue` + `memberTag.ts` / `tagAssignSubmit.ts`             | post 岗位成员、dept 部门管理员     |
| `TagAssignPanel.vue`                                                      | 用户/岗位/部门打标                 |
| `TrialResultPanel.vue`                                                    | permission 试算面板、user 权限预览 |

## 已迁出的跨域共享组件（勿再放回）

历史上有三个组件被 settings / account / layout / user-notice 等域引用却放在本目录，
2026-10-24 已迁至全局 `src/components/`：

- `TaskCenterDrawer` → `@/components/ReTaskCenterDrawer`
- `TaskLogDialog` → `@/components/ReTaskLogDialog`
- `MessageNotifications`（含 SearchDialog）→ `@/components/ReMessageNotifications`
- `NoticeShow` → `@/components/ReNoticeShow`

**判定规则**：新组件若会被 system 之外的模块引用，直接建到 `src/components/ReXxx/`
（遵循 `index.ts` 再导出约定）；仅本域多页共用的放本目录。
