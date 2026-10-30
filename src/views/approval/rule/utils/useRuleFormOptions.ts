import { reactive, shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import { createLevelRow } from "./types";
import {
  buildRuleFormColumns,
  createRuleImpactDraft,
  syncRuleImpactDraft
} from "./ruleFormColumns";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 审批规则新建/编辑表单（元数据驱动，混合形态）：
 * - `name` / `priority` / `is_active` / `remark` 基础字段来自后端元数据；
 * - `path_patterns` / `methods` / `levels` 三条列定制见 ruleFormColumns.ts；
 * - `impact_preview` 扩展字段读取草稿实时值，保存前即可查看在途命中与优先级结果。
 */
export function useRuleFormOptions({
  t,
  canPreview
}: {
  t: TFunction;
  canPreview: boolean;
}) {
  const draft = reactive(createRuleImpactDraft());
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        // 新建态给一级空级次（与原手写表单一致：打开即可填审批人）
        levels: ({ rawRow }: { rawRow?: RecordType }) => {
          const levels = rawRow?.levels;
          return Array.isArray(levels) && levels.length
            ? levels
            : [createLevelRow()];
        },
        // 打开表单时同步预览草稿（含编辑回显）；合成字段本身不进入提交载荷
        impact_preview: ({ rawRow }: { rawRow?: RecordType }) => {
          syncRuleImpactDraft(draft, rawRow);
          return true;
        }
      },
      columns: buildRuleFormColumns({ t, draft, canPreview }),
      // 合成列（impact_preview）只承载实时预览，不是接口字段：表单模型会收集它的
      // 初值 true，必须在提交前剔除——否则真实载荷会带上一个后端不认识的键
      beforeSubmit: ({ formData }: { formData: RecordType }) => {
        const { impact_preview: _preview, ...rest } = formData;
        return rest;
      },
      formProps: {
        rules: {
          // 路径必选：勾选目录与自定义正则合并后为空即拦截（与原手写表单提示一致）
          path_patterns: [
            {
              validator: (
                _rule: unknown,
                value: unknown,
                callback: (error?: Error) => void
              ) => {
                if (Array.isArray(value) && value.length > 0) callback();
                else callback(new Error(t("approvalRule.pathsRequired")));
              },
              trigger: "change"
            }
          ]
        }
      }
    }
  });

  return { addOrEditOptions };
}
