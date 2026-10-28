import { computed, type Ref } from "vue";
import type { PageColumn } from "@/components/RePlusPage";

type Translate = (key: string) => string;

/** 委托表单列：flow_codes 多选（必选）、非超管锁定委托人 */
export function buildDelegationFormColumns({
  flowOptions,
  isSuperuser,
  t
}: {
  flowOptions: Ref<Array<{ label: string; value: string }>>;
  isSuperuser: boolean;
  t: Translate;
}) {
  return ({
    addOrEditColumns,
    addOrEditRules
  }: {
    addOrEditColumns: Ref<PageColumn[]>;
    addOrEditRules?: Ref<Record<string, unknown>>;
  }) => {
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
      // 流程必选：后端契约里 flow_codes 空数组 = 「全部流程」，用户在「没选流程」
      // 的错觉下保存会把委托范围静默放大到全部流程、审批人解析被替换成代理人。
      // 显式必选后，目录加载失败（无可选项）也会被校验拦下，不会以空列表提交；
      // 「全部流程」语义保留给 API 直调与既有数据。
      const rules = [
        {
          required: true,
          type: "array" as const,
          min: 1,
          message: t("systemApprovalDelegation.flowRequired"),
          trigger: "change"
        }
      ];
      // 表单校验实际消费的是 addOrEditRules（按字段名索引的表单级 rules），
      // 列级 rules 只作渲染器兜底：两处同时写，避免「规则写了但不生效」
      if (addOrEditRules) {
        addOrEditRules.value = { ...addOrEditRules.value, flow_codes: rules };
      }
      flowCol.rules = rules;
    }
  };
}
