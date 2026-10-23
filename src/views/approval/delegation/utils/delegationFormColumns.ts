import { computed, type Ref } from "vue";
import type { PageColumn } from "@/components/RePlusPage";

/** 委托表单列：flow_codes 多选、非超管锁定委托人 */
export function buildDelegationFormColumns({
  flowOptions,
  isSuperuser
}: {
  flowOptions: Ref<Array<{ label: string; value: string }>>;
  isSuperuser: boolean;
}) {
  return ({ addOrEditColumns }: { addOrEditColumns: Ref<PageColumn[]> }) => {
    const flowCol = addOrEditColumns.value.find(
      (column: PageColumn) => column._column.key === "flow_codes"
    );
    const delegatorCol = addOrEditColumns.value.find(
      (column: PageColumn) => column._column.key === "delegator"
    );
    if (delegatorCol && !isSuperuser) {
      delegatorCol.fieldProps = {
        ...(delegatorCol.fieldProps ?? {}),
        disabled: true
      };
    }
    if (flowCol) {
      // 元数据按 JSONField 下发的 json 渲染器走 renderField（优先于 valueType），
      // 必须先清掉，否则仍是 jsoneditor 手填
      flowCol.renderField = undefined;
      flowCol.valueType = "select";
      flowCol.options = computed(() => flowOptions.value);
      flowCol.fieldProps = {
        multiple: true,
        filterable: true,
        collapseTags: true,
        collapseTagsTooltip: true
      };
    }
  };
}
