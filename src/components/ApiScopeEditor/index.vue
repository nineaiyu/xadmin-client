<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { ScopeGroup } from "@/utils/scopeDisplay";
import {
  mergeScopes,
  methodTagType,
  splitCustomItems,
  splitSavedScopes
} from "./utils";

import type { ApiScopeEditorProps } from "./types";
/**
 * 接口范围编辑器（访问令牌与 API 应用共用）：勾选「有权限的接口」+ 自定义条目（高级）。
 *
 * 选项由调用方注入的加载器下发（口径 = 请求鉴权同源的权限菜单 × 本人角色），
 * 勾选即「允许该凭证调这个接口」；条目是锚定正则（如 `GET ^/api/identity/user/?$`），
 * 只放行勾选的那一个接口，不连带放行同前缀的兄弟接口或相似前缀（如 /api/identity/user-center）。
 *
 * 已保存的条目里不在选项中的（历史手填、白名单接口、正则）自动落到「自定义」，
 * 保证打开编辑不会丢条目，也让纯文本时代的数据继续可见可改。
 */

defineOptions({ name: "ApiScopeEditor" });

const props = withDefaults(defineProps<ApiScopeEditorProps>(), {
  hideCustom: false
});
/** 已保存的 scope 条目（空 = 不限），双向绑定给调用方 */
const scopes = defineModel<string[]>({ default: () => [] });

const { t, te } = useI18n();
const loading = ref(false);
const groups = ref<ScopeGroup[]>([]);
/** 勾选的选项条目 */
const picked = ref<string[]>([]);
/** 自定义条目文本（一行一条） */
const customText = ref("");

const knownValues = computed(
  () =>
    new Set(
      groups.value.flatMap(group => group.options.map(option => option.value))
    )
);
const customItems = computed(() => splitCustomItems(customText.value));

const merge = () => {
  scopes.value = mergeScopes(picked.value, customItems.value);
};

/** 分组/标题翻译：菜单标题可能是 i18n key（如 menus.userManagement） */
const labelOf = (title: string) =>
  title ? (te(title) ? t(title) : title) : t("apiScope.other");

watch([picked, customText], merge);

onMounted(() => {
  loading.value = true;
  props
    .loadOptions()
    .then(res => {
      if (res.code !== SUCCESS_CODE) return;
      const payload = res.data ?? {};
      groups.value = payload.groups ?? [];
      // 已有条目分流：命中选项的进勾选，其余进自定义（不丢历史/正则条目）
      const saved = scopes.value ?? [];
      const split = splitSavedScopes(saved, knownValues.value);
      picked.value = split.picked;
      if (split.rest.length) customText.value = split.rest.join("\n");
      merge();
    })
    .catch(() => {
      // 选项拉取失败不阻塞：自定义条目仍可用，用户可手填路径
      message(t("results.failed"), { type: "error" });
    })
    .finally(() => {
      loading.value = false;
    });
});

defineExpose({ merge });
</script>

<template>
  <div v-loading="loading">
    <el-alert
      type="info"
      :closable="false"
      :title="t('apiScope.grantTip')"
      class="mb-3"
    />

    <el-select
      v-model="picked"
      multiple
      filterable
      clearable
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="4"
      class="w-full!"
      data-testid="api-scope-select"
      :placeholder="t('apiScope.selectPlaceholder')"
      :no-data-text="t('apiScope.noOptions')"
    >
      <el-option-group
        v-for="group in groups"
        :key="group.key"
        :label="labelOf(group.title)"
      >
        <el-option
          v-for="option in group.options"
          :key="option.value"
          :value="option.value"
          :label="`${option.method} ${option.label}`"
        >
          <div class="flex w-full items-center gap-2">
            <el-tag
              :type="methodTagType(option.method)"
              size="small"
              effect="plain"
            >
              {{ option.method }}
            </el-tag>
            <span class="truncate">{{ option.label }}</span>
            <span class="ml-auto pl-4 text-xs text-(--el-text-color-secondary)">
              {{ option.path }}
            </span>
          </div>
        </el-option>
      </el-option-group>
    </el-select>
    <div class="mt-2 text-xs text-(--el-text-color-regular)">
      {{
        picked.length + customItems.length
          ? t("apiScope.selected", { n: picked.length + customItems.length })
          : t("apiScope.emptyMeansUnlimited")
      }}
    </div>

    <template v-if="!hideCustom">
      <div class="mt-4 mb-1 text-sm font-medium">
        {{ t("apiScope.custom") }}
      </div>
      <el-input
        v-model="customText"
        type="textarea"
        :rows="3"
        :placeholder="t('apiScope.placeholder')"
      />
      <div class="el-form-item__help mt-1">
        {{ t("apiScope.customTip") }}
      </div>
    </template>
  </div>
</template>
