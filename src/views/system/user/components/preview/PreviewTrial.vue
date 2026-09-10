<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { userApi } from "@/api/system/user";
import { message } from "@/utils/message";
import type {
  PreviewMenuItem,
  TrialCandidate,
  TrialResult
} from "@/api/types/permission-preview";

defineOptions({ name: "PreviewTrial" });

const props = withDefaults(
  defineProps<{
    /** 目标用户 pk */
    pk: string;
    /** 试算模型候选（数据权限注册表） */
    candidates: TrialCandidate[];
    /** 目标用户可见菜单树（页面菜单作为上下文选项） */
    menuTree: PreviewMenuItem[];
    /** 是否持有 previewTrial 权限码（缺失时只提示、不发请求） */
    canTrial?: boolean;
  }>(),
  { canTrial: true }
);

const { t } = useI18n();

const model = ref<string>("");
/** "" 表示通用授权（不限定菜单上下文），避免给 el-option 传 null 触发 prop 类型告警 */
const menuContext = ref<string>("");
const loading = ref(false);
const result = ref<TrialResult | null>(null);

/** 页面菜单（menu_type=1）扁平化为上下文选项 */
const menuOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [];
  const walk = (nodes: PreviewMenuItem[]) => {
    nodes.forEach(node => {
      if (node.menu_type === 1) {
        options.push({ value: node.pk, label: node.title });
      }
      if (node.children?.length) walk(node.children);
    });
  };
  walk(props.menuTree);
  return options;
});

const canRun = computed(() => Boolean(model.value) && !loading.value);

async function runTrial() {
  if (!canRun.value) return;
  loading.value = true;
  try {
    const res = await userApi.previewTrial(props.pk, {
      model: model.value,
      menu: menuContext.value ? menuContext.value : null
    });
    result.value = res.data;
  } catch {
    // 失败（含 403 无码）就地提示，不依赖全局拦截器的静默处理
    result.value = null;
    message(t("permissionPreview.trialFailed"), { type: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <el-alert
      v-if="!canTrial"
      :closable="false"
      :title="t('permissionPreview.trialNoAuth')"
      show-icon
      type="info"
    />
    <el-empty
      v-else-if="!candidates.length"
      :description="t('permissionPreview.noModels')"
      :image-size="70"
    />
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <el-select
          v-model="model"
          :placeholder="t('permissionPreview.model')"
          class="w-70!"
          filterable
        >
          <el-option
            v-for="candidate in candidates"
            :key="candidate.label"
            :label="candidate.display"
            :value="candidate.label"
          >
            <span>{{ candidate.display }}</span>
            <el-tag
              v-if="candidate.has_rules"
              type="warning"
              size="small"
              class="ml-1"
            >
              {{ t("permissionPreview.hasRules") }}
            </el-tag>
          </el-option>
        </el-select>
        <el-select
          v-model="menuContext"
          :placeholder="t('permissionPreview.menuContext')"
          class="w-60!"
          clearable
          filterable
        >
          <el-option :label="t('permissionPreview.generalGrant')" :value="''" />
          <el-option
            v-for="option in menuOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!canRun"
          @click="runTrial"
        >
          {{ t("permissionPreview.run") }}
        </el-button>
      </div>

      <template v-if="result">
        <div class="mt-3 flex items-center gap-2">
          <span class="text-sm text-gray-500">{{
            t("permissionPreview.hitCount")
          }}</span>
          <span class="text-xl font-semibold">{{ result.count }}</span>
        </div>
        <el-alert
          v-if="result.note"
          :title="result.note"
          type="warning"
          :closable="false"
          show-icon
          class="mt-2"
        />
        <el-input
          :model-value="result.sql"
          type="textarea"
          readonly
          :rows="6"
          class="mt-2"
          :label="t('permissionPreview.sql')"
        />
      </template>
    </template>
  </div>
</template>
