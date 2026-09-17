<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import {
  systemModuleApi,
  type ModuleLevel,
  type SystemModulesData
} from "@/api/system/modules";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";

defineOptions({
  name: "SystemModule" // 必须定义，用于菜单自动匹配组件
});

const { t } = useI18n();

const loading = ref(true);
const data = ref<SystemModulesData | null>(null);

/** 等级 → 标签色（内核不可裁 / 标配默认开 / 可选按需开） */
const LEVEL_TAG_TYPE: Record<ModuleLevel, "info" | "success" | "warning"> = {
  core: "info",
  standard: "success",
  optional: "warning"
};
const LEVEL_KEY: Record<ModuleLevel, string> = {
  core: "levelCore",
  standard: "levelStandard",
  optional: "levelOptional"
};

const rows = computed(() => data.value?.modules ?? []);
const summary = computed(() => {
  const item = data.value;
  return item
    ? t("systemModule.enabledSummary", {
        enabled: item.enabled_count,
        total: item.total
      })
    : "";
});

const load = async () => {
  loading.value = true;
  // 统一归一异常：业务码非 1000（如无权限 403 归一）也要给出可读提示
  const res = await systemModuleApi.list().catch(error => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error),
    data: null
  }));
  loading.value = false;
  if (res.code !== SUCCESS_CODE || !res.data) {
    message(String(res.detail ?? t("systemModule.loadFailed")), {
      type: "warning"
    });
    return;
  }
  data.value = res.data;
};

const copySnippet = async () => {
  const snippet = data.value?.config_snippet ?? "";
  if (!snippet) return;
  try {
    await navigator.clipboard.writeText(snippet);
    message(t("systemModule.copied"), { type: "success" });
  } catch {
    message(t("systemModule.copyFailed"), { type: "warning" });
  }
};

onMounted(load);
</script>

<template>
  <div class="module-page">
    <el-card v-loading="loading" shadow="never" class="mb-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="text-base font-medium">
          {{ t("systemModule.currentPreset") }}：
          <el-tag type="primary" effect="dark">{{ data?.preset }}</el-tag>
        </div>
        <div class="text-sm text-gray-500" data-testid="module-summary">
          {{ summary }}
        </div>
        <el-alert
          class="flex-1"
          type="info"
          :closable="false"
          show-icon
          :title="t('systemModule.restartTip')"
        />
      </div>
      <div v-if="data?.disabled.length" class="mt-3 text-sm text-gray-500">
        {{ t("systemModule.disabledModules") }}：{{ data.disabled.join(", ") }}
      </div>
    </el-card>

    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex-bc">
          <span>{{ t("systemModule.configSnippet") }}</span>
          <el-button
            type="primary"
            plain
            size="small"
            data-testid="module-copy"
            @click="copySnippet"
          >
            {{ t("systemModule.copy") }}
          </el-button>
        </div>
      </template>
      <el-input
        :model-value="data?.config_snippet"
        type="textarea"
        :rows="4"
        readonly
        data-testid="module-snippet"
      />
      <div class="mt-2 text-xs text-gray-400">
        {{ t("systemModule.docsTip") }} {{ data?.docs }}
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" row-key="id" data-testid="module-table">
        <el-table-column
          prop="id"
          :label="t('systemModule.moduleId')"
          min-width="180"
        />
        <el-table-column
          prop="label"
          :label="t('systemModule.moduleName')"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('systemModule.level')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="LEVEL_TAG_TYPE[row.level as ModuleLevel]">
              {{ t(`systemModule.${LEVEL_KEY[row.level as ModuleLevel]}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('systemModule.status')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'">
              {{
                row.enabled
                  ? t("systemModule.enabled")
                  : t("systemModule.disabled")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('systemModule.coverage')"
          width="140"
          align="center"
        >
          <template #default="{ row }">
            {{
              t("systemModule.coverageValue", {
                menus: row.menus,
                routes: row.routes
              })
            }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('systemModule.depends')"
          min-width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.depends.length ? row.depends.join(", ") : "-" }}
          </template>
        </el-table-column>
        <el-table-column
          prop="note"
          :label="t('systemModule.note')"
          min-width="260"
          show-overflow-tooltip
        />
      </el-table>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.module-page {
  :deep(.el-card__body) {
    padding: 16px;
  }
}
</style>
