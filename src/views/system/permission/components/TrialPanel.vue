<script lang="ts" setup>
import SearchUser from "@/views/system/components/SearchUser.vue";
import TrialResultPanel from "@/views/system/components/TrialResultPanel.vue";
import { useTrialPanel, type TrialPanelProps } from "./useTrialPanel";

defineOptions({ name: "PermissionTrialPanel" });

const props = withDefaults(defineProps<TrialPanelProps>(), {
  rules: () => [],
  ruleList: () => [],
  fieldRuleList: () => [],
  menus: () => []
});

const {
  t,
  activeNames,
  canTrial,
  scope,
  targetUser,
  formMode,
  boundMenuPks,
  model,
  menuContext,
  loading,
  result,
  effectiveMode,
  modeOverridden,
  modelOptions,
  canRunData,
  dataStale,
  handleModeChange,
  runDataTrial,
  fieldResult,
  fieldModelOptions,
  draftFieldModel,
  draftFieldNames,
  draftFieldNameOptions,
  draftEntries,
  canRunField,
  addDraftFields,
  removeDraftEntry,
  runFieldTrial
} = useTrialPanel(props);
</script>

<template>
  <el-collapse v-model="activeNames" class="mt-2">
    <el-collapse-item :title="t('permissionPreview.trialDraft')" name="trial">
      <el-alert
        v-if="!canTrial"
        :closable="false"
        :title="t('permissionPreview.trialNoAuth')"
        show-icon
        type="info"
      />
      <template v-else>
        <el-alert
          :closable="false"
          :title="t('permissionPreview.trialHint')"
          class="mb-2"
          show-icon
          type="info"
        />
        <el-radio-group v-model="scope" size="small" class="mb-2">
          <el-radio-button value="data">
            {{ t("permissionPreview.trialDataScope") }}
          </el-radio-button>
          <el-radio-button value="field">
            {{ t("permissionPreview.trialFieldScope") }}
          </el-radio-button>
        </el-radio-group>

        <!-- 数据权限：用户 + 模型 + 菜单上下文 + 且/或模式 -->
        <div v-if="scope === 'data'" class="flex flex-wrap items-center gap-2">
          <SearchUser v-model="targetUser" :multiple="false" class="w-60!" />
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
          <el-select
            :model-value="effectiveMode"
            class="w-32!"
            @update:model-value="handleModeChange"
          >
            <el-option :label="t('permissionPreview.modeOr')" :value="0" />
            <el-option :label="t('permissionPreview.modeAnd')" :value="1" />
          </el-select>
          <el-tooltip
            v-if="modeOverridden"
            :content="
              t('permissionPreview.modeOverrideHint', {
                mode:
                  formMode === 1
                    ? t('permissionPreview.modeAnd')
                    : t('permissionPreview.modeOr')
              })
            "
          >
            <el-tag size="small" type="warning">
              {{ t("permissionPreview.modeOverride") }}
            </el-tag>
          </el-tooltip>
          <el-button
            :disabled="!canRunData"
            :loading="loading"
            type="primary"
            @click="runDataTrial"
          >
            {{ t("permissionPreview.run") }}
          </el-button>
        </div>
        <el-text v-else class="mb-1" size="small" type="info">
          {{ t("permissionPreview.fieldDraftTip") }}
        </el-text>

        <el-text
          v-if="scope === 'data' && !rules.length"
          class="mt-2"
          type="info"
        >
          {{ t("permissionPreview.draftEmpty") }}
        </el-text>
        <el-text
          v-if="scope === 'data' && boundMenuPks.length"
          class="mt-2"
          size="small"
          type="info"
        >
          {{
            t("permissionPreview.boundMenuHint", {
              count: boundMenuPks.length
            })
          }}
        </el-text>

        <!-- 数据权限结果 -->
        <TrialResultPanel
          v-if="scope === 'data' && result"
          :result="result"
          show-draft
          :stale="dataStale"
        />

        <!-- 字段权限：用户 + 菜单（必填）+ 可选草稿白名单 -->
        <template v-if="scope === 'field'">
          <div class="flex flex-wrap items-center gap-2">
            <SearchUser v-model="targetUser" :multiple="false" class="w-60!" />
            <el-select
              v-model="menuContext"
              :placeholder="t('permissionPreview.menuContext')"
              class="w-50!"
              clearable
              filterable
            >
              <el-option
                v-for="menu in menus"
                :key="menu.value"
                :label="menu.label"
                :value="menu.value"
              />
            </el-select>
            <el-button
              :disabled="!canRunField"
              :loading="loading"
              type="primary"
              @click="runFieldTrial"
            >
              {{ t("permissionPreview.run") }}
            </el-button>
          </div>
          <el-text v-if="!menuContext" class="mt-2" type="info">
            {{ t("permissionPreview.fieldMenuRequired") }}
          </el-text>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <el-select
              v-model="draftFieldModel"
              :placeholder="t('permissionPreview.draftModel')"
              class="w-50!"
              clearable
              filterable
            >
              <el-option
                v-for="option in fieldModelOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select
              v-model="draftFieldNames"
              :disabled="!draftFieldModel"
              :placeholder="t('permissionPreview.draftFields')"
              class="w-60!"
              collapse-tags
              filterable
              multiple
            >
              <el-option
                v-for="option in draftFieldNameOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-button
              :disabled="!draftFieldModel || !draftFieldNames.length"
              @click="addDraftFields"
            >
              {{ t("buttons.add") }}
            </el-button>
          </div>
          <div v-if="draftEntries.length" class="mt-1">
            <el-tag
              v-for="entry in draftEntries"
              :key="entry.model"
              class="mr-1"
              closable
              size="small"
              type="warning"
              @close="removeDraftEntry(entry.model)"
            >
              {{ entry.label }}：{{ entry.text }}
            </el-tag>
          </div>

          <!-- 字段权限结果 -->
          <template v-if="fieldResult">
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="text-sm text-(--el-text-color-regular)">
                {{ t("permissionPreview.fieldResultTitle") }}
              </span>
              <el-tag v-if="!fieldResult.enabled" size="small" type="warning">
                {{ t("permissionPreview.fieldDisabled") }}
              </el-tag>
              <el-tag
                v-if="fieldResult.draft_applied"
                size="small"
                type="warning"
              >
                {{ t("permissionPreview.draftApplied") }}
              </el-tag>
            </div>
            <el-alert
              v-if="fieldResult.note"
              :title="fieldResult.note"
              class="mt-2"
              :closable="false"
              show-icon
              type="warning"
            />
            <div
              v-for="item in fieldResult.models"
              :key="item.model"
              class="mt-2 rounded border border-gray-200 p-2 dark:border-gray-700"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ item.model_label }}</span>
                <el-tag size="small" type="info">{{ item.model }}</el-tag>
                <el-tag
                  size="small"
                  :type="item.configured ? 'success' : 'danger'"
                >
                  {{
                    item.configured
                      ? t("permissionPreview.fieldVisible", {
                          visible: item.fields.length,
                          total: item.total_fields
                        })
                      : t("permissionPreview.fieldUnconfigured")
                  }}
                </el-tag>
              </div>
              <div class="mt-1">
                <el-tag
                  v-for="(label, index) in item.field_labels"
                  :key="item.fields[index]"
                  class="mr-1 mb-1"
                  size="small"
                  :type="
                    item.draft_fields.includes(item.fields[index])
                      ? 'warning'
                      : undefined
                  "
                >
                  {{ label }}
                </el-tag>
                <el-text v-if="!item.fields.length" size="small" type="info">
                  {{ t("permissionPreview.fieldNone") }}
                </el-text>
              </div>
            </div>
          </template>
        </template>
      </template>
    </el-collapse-item>
  </el-collapse>
</template>
