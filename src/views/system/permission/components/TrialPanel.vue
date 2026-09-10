<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { userApi } from "@/api/system/user";
import { hasAuth } from "@/router/utils";
import SearchUser from "@/views/system/components/SearchUser.vue";
import type { TrialResult } from "@/api/types/permission-preview";
import type { FieldLookupNode, FieldRuleRow } from "./utils/types";

defineOptions({ name: "PermissionTrialPanel" });

/**
 * 配置页即时试算：把当前表单里**尚未保存**的规则作为草稿传给试算接口，
 * 选择目标用户后即可看到「加了这组规则后该用户能查到多少行」，
 * 无需先保存再去用户页验证。草稿不落库，且与保存走同一套写入校验。
 */
const props = withDefaults(
  defineProps<{
    /** 当前表单里的规则（草稿） */
    rules?: FieldRuleRow[];
    /** 数据权限注册表树（取第二层作为试算模型候选） */
    ruleList?: FieldLookupNode[];
    /** 菜单上下文候选（绑定菜单的授权只在该上下文生效） */
    menus?: Array<{ value: string; label: string }>;
  }>(),
  { rules: () => [], ruleList: () => [], menus: () => [] }
);

const { t } = useI18n();

const targetUser = ref<Array<Record<string, unknown>>>([]);
const model = ref("");
const menuContext = ref("");
/** 0 = 或模式 / 1 = 且模式（与后端 ModeTypeAbstract.ModeChoices 对齐） */
const mode = ref(0);
const loading = ref(false);
const result = ref<TrialResult | null>(null);

/** 试算有独立权限码：缺失时只提示，不发必然 403 的请求 */
const canTrial = computed(() => hasAuth("previewTrial:SystemUser"));

/** 模型候选 = 注册表树第二层（app → model → field） */
const modelOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [];
  props.ruleList.forEach(app => {
    (app.children ?? []).forEach(modelNode => {
      if (!modelNode.name || modelNode.name === "*") return;
      options.push({
        value: modelNode.name,
        label: `${modelNode.label ?? modelNode.name} (${modelNode.name})`
      });
    });
  });
  return options;
});

const targetPk = computed(() => {
  const first = targetUser.value[0] as { pk?: string | number } | undefined;
  return first?.pk ? String(first.pk) : "";
});

const canRun = computed(
  () =>
    Boolean(targetPk.value && model.value && props.rules.length) &&
    !loading.value
);

async function runTrial() {
  if (!canRun.value) return;
  loading.value = true;
  try {
    const res = await userApi.previewTrial(targetPk.value, {
      model: model.value,
      menu: menuContext.value ? menuContext.value : null,
      draft: {
        rules: props.rules as unknown as Array<Record<string, unknown>>,
        mode_type: mode.value
      }
    });
    result.value = res.data;
  } catch {
    result.value = null;
    message(t("permissionPreview.trialFailed"), { type: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <el-collapse class="mt-2">
    <el-collapse-item :title="t('permissionPreview.trialDraft')" name="trial">
      <el-alert
        v-if="!canTrial"
        :closable="false"
        :title="t('permissionPreview.trialNoAuth')"
        show-icon
        type="info"
      />
      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <SearchUser v-model="targetUser" class="w-60!" />
          <el-select
            v-model="model"
            :placeholder="t('permissionPreview.model')"
            class="w-60!"
            filterable
          >
            <el-option
              v-for="option in modelOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-model="menuContext"
            :placeholder="t('permissionPreview.menuContext')"
            class="w-50!"
            clearable
            filterable
          >
            <el-option
              :label="t('permissionPreview.generalGrant')"
              :value="''"
            />
            <el-option
              v-for="menu in menus"
              :key="menu.value"
              :label="menu.label"
              :value="menu.value"
            />
          </el-select>
          <el-select v-model="mode" class="w-32!">
            <el-option :label="t('permissionPreview.modeOr')" :value="0" />
            <el-option :label="t('permissionPreview.modeAnd')" :value="1" />
          </el-select>
          <el-button
            :disabled="!canRun"
            :loading="loading"
            type="primary"
            @click="runTrial"
          >
            {{ t("permissionPreview.run") }}
          </el-button>
        </div>

        <el-text v-if="!rules.length" class="mt-2" type="info">
          {{ t("permissionPreview.draftEmpty") }}
        </el-text>

        <template v-if="result">
          <div class="mt-3 flex items-center gap-2">
            <span class="text-sm text-gray-500">{{
              t("permissionPreview.hitCount")
            }}</span>
            <span class="text-xl font-semibold">{{ result.count }}</span>
            <el-tag
              :type="result.draft_applied ? 'success' : 'info'"
              size="small"
            >
              {{
                result.draft_applied
                  ? t("permissionPreview.draftApplied")
                  : t("permissionPreview.draftSkipped")
              }}
            </el-tag>
          </div>
          <el-alert
            v-if="result.note"
            :title="result.note"
            class="mt-2"
            :closable="false"
            show-icon
            type="warning"
          />
          <el-input
            :model-value="result.sql"
            class="mt-2"
            :rows="5"
            readonly
            type="textarea"
          />
        </template>
      </template>
    </el-collapse-item>
  </el-collapse>
</template>
