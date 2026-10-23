<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { h } from "vue";
import {
  approvalRuleApi,
  type ApprovalRuleImpact
} from "@/api/approval/approvalRule";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";

/**
 * 审批规则影响面预览（草稿实时值）：按当前路径/方法/优先级/启用状态，
 * 查询在途审批单中会命中该规则的单据，并给出与现有规则的优先级对比。
 */
defineOptions({ name: "ApprovalRuleImpactField" });

const props = defineProps<{
  draft: {
    pk?: string;
    path_patterns: string[];
    methods: string[];
    priority: number;
    is_active: boolean;
  };
  allowed?: boolean;
}>();

const { t } = useI18n();
const loading = ref(false);
const result = ref<ApprovalRuleImpact | null>(null);
const error = ref("");

const showItems = (data: ApprovalRuleImpact) => {
  const items = data.items ?? [];
  const body = h("div", [
    h("p", t("approvalRule.impactTotal", { total: data.total })),
    data.rule_active
      ? null
      : h("p", { class: "text-warning" }, t("approvalRule.impactInactive")),
    ...items.slice(0, 10).map(item =>
      h(
        "div",
        {
          class:
            "mt-1 rounded border border-solid border-[var(--el-border-color-lighter)] p-2 text-xs"
        },
        [
          h("div", `${item.method} ${item.path}`),
          h(
            "div",
            { class: "text-[var(--el-text-color-secondary)]" },
            `${item.applicant || "-"} · ${item.current_rule || t("approvalRule.impactNoRule")}`
          ),
          h(
            "div",
            {
              class: item.draft_wins ? "text-success" : "text-warning"
            },
            item.draft_wins
              ? t("approvalRule.impactWins")
              : t("approvalRule.impactOutranked")
          )
        ]
      )
    ),
    data.truncated
      ? h(
          "p",
          { class: "text-xs text-[var(--el-text-color-secondary)]" },
          t("approvalRule.impactTruncated", { count: items.length })
        )
      : null,
    h(
      "p",
      { class: "mt-2 text-xs text-[var(--el-text-color-secondary)]" },
      t("approvalRule.impactNote")
    )
  ]);
  ElMessageBox.alert(body, t("approvalRule.impactTitle"), {
    confirmButtonText: t("buttons.close")
  }).catch(() => undefined);
};

const preview = async () => {
  if (!props.allowed) {
    message(t("approvalRule.impactNoPermission"), { type: "warning" });
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const res = await approvalRuleApi
      .impactPreview({
        pk: props.draft.pk,
        path_patterns: props.draft.path_patterns,
        methods: props.draft.methods,
        priority: Number(props.draft.priority) || 0,
        is_active: props.draft.is_active
      })
      .catch(normalizeError);
    if (!isSuccess(res)) {
      error.value = String(res.detail || t("approvalRule.impactFailed"));
      return;
    }
    result.value = res.data ?? null;
    if (result.value) showItems(result.value);
  } catch {
    error.value = t("approvalRule.impactFailed");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="approval-rule-impact">
    <el-alert
      :closable="false"
      type="info"
      :title="t('approvalRule.impactHint')"
    />
    <div class="mt-2 flex items-center gap-2">
      <el-button
        type="primary"
        plain
        size="small"
        :loading="loading"
        :disabled="!allowed"
        @click="preview"
      >
        {{ t("approvalRule.impactPreview") }}
      </el-button>
      <span v-if="result" class="text-xs text-(--el-text-color-secondary)">
        {{ t("approvalRule.impactTotal", { total: result.total }) }}
      </span>
      <span v-if="error" class="text-xs text-(--el-color-danger)">
        {{ error }}
      </span>
    </div>
  </div>
</template>
