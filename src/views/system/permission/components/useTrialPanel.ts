import { useTrialContext } from "./useTrialContext";
import { useTrialDataPanel } from "./useTrialDataPanel";
import { useTrialFieldPanel } from "./useTrialFieldPanel";
import type { TrialPanelProps } from "./useTrialContext";

export type { TrialPanelProps } from "./useTrialContext";

/**
 * 即时试算（配置页，草稿不落库）组装入口：
 * - 数据权限：预演「该用户按这组规则能查到多少行」——与保存走同一套写入校验，
 *   不能绕过校验（useTrialDataPanel）；
 * - 字段权限：预演「该用户在某菜单下实际能看到哪些字段」（未配置=裁空），
 *   可叠加一份未保存的字段白名单草稿（useTrialFieldPanel）；
 * - 共享上下文（折叠态/权限码/作用域/目标用户/表单草稿上下文）见 useTrialContext。
 *
 * 跨域依赖登记：试算复用 SystemUser 域的能力——权限点 `previewTrial:SystemUser`
 * 与 userApi.previewTrial / previewFieldTrial（`/api/system/user/{pk}/preview/trial`、
 * `.../preview/field-trial`）；用户域权限点或这两个端点变更时需同步本页。
 */
export function useTrialPanel(props: TrialPanelProps) {
  const ctx = useTrialContext(props);
  const data = useTrialDataPanel({ props, ctx });
  const field = useTrialFieldPanel({ props, ctx });

  return {
    t: ctx.t,
    activeNames: ctx.activeNames,
    canTrial: ctx.canTrial,
    scope: ctx.scope,
    targetUser: ctx.targetUser,
    formMode: ctx.formMode,
    boundMenuPks: ctx.boundMenuPks,
    targetPk: ctx.targetPk,
    menuContext: ctx.menuContext,
    loading: ctx.loading,
    result: data.result,
    modeOverride: data.modeOverride,
    effectiveMode: data.effectiveMode,
    modeOverridden: data.modeOverridden,
    model: data.model,
    modelOptions: data.modelOptions,
    canRunData: data.canRunData,
    dataStale: data.dataStale,
    handleModeChange: data.handleModeChange,
    runDataTrial: data.runDataTrial,
    fieldResult: field.fieldResult,
    fieldModelOptions: field.fieldModelOptions,
    draftFieldModel: field.draftFieldModel,
    draftFieldNames: field.draftFieldNames,
    draftFieldNameOptions: field.draftFieldNameOptions,
    draftEntries: field.draftEntries,
    canRunField: field.canRunField,
    addDraftFields: field.addDraftFields,
    removeDraftEntry: field.removeDraftEntry,
    runFieldTrial: field.runFieldTrial
  };
}
