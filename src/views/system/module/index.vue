<script lang="ts" setup>
import type { ModuleLevel } from "@/api/system/modules";
import { useSystemModule } from "./utils/hook";

defineOptions({
  name: "SystemModule" // 必须定义，用于菜单自动匹配组件
});

const {
  t,
  loading,
  saving,
  data,
  draftPreset,
  draftEnabled,
  LEVEL_TAG_TYPE,
  LEVEL_KEY,
  canApply,
  canReset,
  presets,
  rows,
  summary,
  baselineText,
  onPresetChange,
  onToggle,
  save,
  resetToBaseline,
  copyText
} = useSystemModule();
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
        <el-tag v-if="data?.override_active" type="warning" effect="plain">
          {{ t("systemModule.overrideActive") }}
        </el-tag>
        <el-alert
          class="flex-1"
          type="info"
          :closable="false"
          show-icon
          :title="t('systemModule.restartTip')"
        />
      </div>
      <div class="mt-3 text-sm text-gray-500" data-testid="module-baseline">
        {{ t("systemModule.baseline") }}：{{ baselineText }}
      </div>
      <div v-if="data?.disabled.length" class="mt-3 text-sm text-gray-500">
        {{ t("systemModule.disabledModules") }}：{{ data.disabled.join(", ") }}
      </div>
      <el-alert
        v-if="data?.pending"
        class="mt-3"
        type="warning"
        :closable="false"
        show-icon
        :title="t('systemModule.pendingTitle')"
        data-testid="module-pending"
      >
        <div class="text-sm">{{ t("systemModule.pendingTip") }}</div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="text-sm">{{ t("systemModule.desiredPreset") }}：</span>
          <el-tag type="primary" effect="plain">{{
            data.desired.preset
          }}</el-tag>
          <template v-if="data.diff.preset_changed">
            <el-tag type="info" effect="plain">
              {{ t("systemModule.presetChanged") }}
            </el-tag>
          </template>
          <template v-if="data.diff.enable.length">
            <span class="text-sm">{{ t("systemModule.diffEnable") }}：</span>
            <el-tag
              v-for="id in data.diff.enable"
              :key="`enable-${id}`"
              type="success"
              effect="plain"
            >
              {{ id }}
            </el-tag>
          </template>
          <template v-if="data.diff.disable.length">
            <span class="text-sm">{{ t("systemModule.diffDisable") }}：</span>
            <el-tag
              v-for="id in data.diff.disable"
              :key="`disable-${id}`"
              type="danger"
              effect="plain"
            >
              {{ id }}
            </el-tag>
          </template>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="text-sm">{{ t("systemModule.restartCommand") }}：</span>
          <el-tag
            type="info"
            effect="plain"
            data-testid="module-restart-command"
          >
            {{ data.restart_command }}
          </el-tag>
          <el-button
            type="primary"
            plain
            size="small"
            data-testid="module-copy-command"
            @click="copyText(data.restart_command)"
          >
            {{ t("systemModule.copyCommand") }}
          </el-button>
        </div>
      </el-alert>
    </el-card>

    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex-bc">
          <span>{{ t("systemModule.editTitle") }}</span>
          <div class="flex items-center gap-2">
            <el-button
              v-if="canReset"
              :disabled="saving || !data?.override_active"
              data-testid="module-reset"
              @click="resetToBaseline"
            >
              {{ t("systemModule.reset") }}
            </el-button>
            <el-button
              v-if="canApply"
              type="primary"
              :loading="saving"
              data-testid="module-save"
              @click="save"
            >
              {{ t("systemModule.save") }}
            </el-button>
          </div>
        </div>
      </template>
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <span class="text-sm text-gray-500"
          >{{ t("systemModule.selectPreset") }}：</span
        >
        <el-radio-group
          :model-value="draftPreset"
          data-testid="module-preset"
          @change="onPresetChange"
        >
          <el-radio-button
            v-for="preset in presets"
            :key="preset.value"
            :value="preset.value"
          >
            {{ preset.label }}
          </el-radio-button>
        </el-radio-group>
        <span class="text-xs text-gray-400">{{
          t("systemModule.editTip")
        }}</span>
      </div>
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
          :label="t('systemModule.enableSwitch')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tooltip
              :disabled="row.level !== 'core'"
              :content="t('systemModule.coreLocked')"
            >
              <el-switch
                :model-value="draftEnabled.has(row.id)"
                :disabled="row.level === 'core' || !canApply"
                @change="value => onToggle(row.id, value)"
              />
            </el-tooltip>
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

    <el-card shadow="never">
      <template #header>
        <div class="flex-bc">
          <span>{{ t("systemModule.configSnippet") }}</span>
          <el-button
            type="primary"
            plain
            size="small"
            data-testid="module-copy"
            @click="copyText(data?.config_snippet ?? '')"
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
  </div>
</template>

<style lang="scss" scoped>
.module-page {
  :deep(.el-card__body) {
    padding: 16px;
  }
}
</style>
