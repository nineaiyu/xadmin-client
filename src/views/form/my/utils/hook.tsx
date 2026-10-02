import { SUCCESS_CODE } from "@/api/types";
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { usePageAuth } from "@/router/utils";
import type { FillableFormItem } from "@/api/dataset/dform";
import { submissionApi } from "@/api/dataset/dform";
import { useFormMyActions } from "./useFormMyActions";
import { useFormMyColumns } from "./useFormMyColumns";

export { submissionDataText } from "./submissionData";

/**
 * 我的填报（FormMySubmission）页面装配。
 *
 * 列表迁 RePlusPage 后本页只保留两处页面级形态：
 * - 顶部「可填表单」卡片区（填报入口，非表格工具栏语义）；
 * - 表格区由框架统一接管搜索、分页、列设置与行操作收敛。
 *
 * 提交数据（`data` JSON）不在后端 table_fields 里，由 `listColumnsFormat` 注入一列摘要；
 * 状态列覆写为语义色 tag（字典未配 color 时兜底），无状态的提交显示「无需审批」。
 *
 * 职责拆分：
 * - useFormMyActions  填报/编辑弹窗、详情抽屉与删除/提交/重新提交；
 * - useFormMyColumns  列渲染（状态 tag、摘要列）、搜索区裁剪与行操作按钮；
 * - submissionData    提交数据摘要文案（纯函数）。
 */
export function useFormMySubmissions() {
  const { t } = useI18n();
  const tableRef = ref();
  const forms = ref<FillableFormItem[]>([]);

  const api = reactive(submissionApi);
  const auth = usePageAuth([
    "submit",
    "resubmit",
    "exportData",
    "availableForms",
    "userOptions"
  ]);
  // 本页「新增」入口是顶部可填表单卡片（选择表单填报），关闭表格工具栏的默认新增
  auth.create = false;

  const canEdit = hasAuth("partialUpdate:FormMySubmission");
  const canDestroy = hasAuth("destroy:FormMySubmission");
  const canResubmit = hasAuth("resubmit:FormMySubmission");
  const canSubmit = hasAuth("submit:FormMySubmission");

  /** 可填报表单（启用中）：填报卡片数据源 */
  const loadForms = async () => {
    const res = await submissionApi.availableForms().catch(() => null);
    if (res?.code === SUCCESS_CODE) {
      forms.value = (res.data ?? []) as FillableFormItem[];
    }
  };

  onMounted(loadForms);

  const actions = useFormMyActions({ t, tableRef, forms });

  const { listColumnsFormat, searchColumnsFormat, operationButtonsProps } =
    useFormMyColumns({
      t,
      canEdit,
      canDestroy,
      canResubmit,
      canSubmit,
      actions
    });

  return {
    api,
    auth,
    tableRef,
    forms,
    listColumnsFormat,
    searchColumnsFormat,
    operationButtonsProps,
    openFill: actions.openFill,
    loadForms
  };
}
