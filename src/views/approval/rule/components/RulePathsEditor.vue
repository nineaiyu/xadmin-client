<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { loadPatScopeCatalog } from "@/api/user/token";
import type { ScopeGroup } from "@/utils/scopeDisplay";
import { mergeUnique } from "@/utils/unique";

/**
 * 审批规则「匹配路径」编辑器（自 RuleForm 拆出，行为不变）：
 *
 * - 上半部：从接口清单（与访问令牌同源目录，按本人权限收口）勾选路径；
 * - 下半部：自定义路径正则（一行一条，高级用法，含历史数据回显）。
 *
 * 对外值 = 勾选路径 ∪ 自定义路径（去重后的字符串数组，直接对应 `path_patterns`）；
 * 打开时按「是否命中当前目录」把已保存值分回两侧，保证历史正则不丢。
 */
defineOptions({ name: "ApprovalRulePathsEditor" });

const props = defineProps<{
  modelValue?: string[] | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [values: string[]];
}>();

const { t, te } = useI18n();

const scopeGroups = ref<ScopeGroup[]>([]);
const scopeLoading = ref(false);
/** 目录加载失败：不再静默只剩自定义正则 */
const scopeError = ref(false);
const pathSelected = ref<string[]>([]);
const customPaths = ref("");

/** scope 条目（`GET ^/api/...$`）→ 路径正则（`^/api/...$`）：审批拦截按路径匹配 */
const toPathPattern = (value: string) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/);
  return parts.slice(1).join(" ").trim() || value;
};

/** 分组标题翻译：菜单标题可能是 i18n key（与接口范围编辑器同口径） */
const labelOf = (title: string) =>
  title ? (te(title) ? t(title) : title) : t("apiScope.other");

const knownPaths = computed(
  () =>
    new Set(
      scopeGroups.value.flatMap(group => group.options.map(item => item.value))
    )
);

const customPathList = computed(() =>
  customPaths.value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean)
);

const merged = computed(() =>
  mergeUnique(pathSelected.value, customPathList.value)
);

/** 已保存路径分流：命中目录的进勾选，其余（历史正则/白名单接口）进自定义区 */
const splitValue = (value: string[]) => {
  if (!knownPaths.value.size) {
    // 目录尚未加载：先整体落到自定义区，目录到达后再重新分流
    customPaths.value = value.join("\n");
    pathSelected.value = [];
    return;
  }
  pathSelected.value = value.filter(item => knownPaths.value.has(item));
  customPaths.value = value
    .filter(item => !knownPaths.value.has(item))
    .join("\n");
};

const emitValue = () => {
  emit("update:modelValue", merged.value);
};

const loadScopeGroups = async () => {
  scopeLoading.value = true;
  scopeError.value = false;
  try {
    const res = await loadPatScopeCatalog();
    if (!isSuccess(res) || !res.data?.groups) {
      scopeError.value = true;
      return;
    }
    scopeGroups.value = res.data.groups.map(group => {
      const seen = new Set<string>();
      const options = (group.options ?? [])
        .map(option => ({ ...option, value: toPathPattern(option.value) }))
        .filter(option => {
          if (!option.value || seen.has(option.value)) return false;
          seen.add(option.value);
          return true;
        });
      return { ...group, options };
    });
    // 目录到达后重新分流已保存值（此前整体落在自定义区）
    splitValue(props.modelValue ?? []);
  } catch {
    // 目录拉取失败不阻塞：自定义区仍可写路径正则
    scopeError.value = true;
  } finally {
    scopeLoading.value = false;
  }
};

// 外部值变化（编辑回显 / 表单重置）时重新分流；与本地合并值相同则跳过，避免输入抖动
watch(
  () => props.modelValue,
  value => {
    const next = value ?? [];
    if (next.join("\n") === merged.value.join("\n")) return;
    splitValue(next);
  }
);

onMounted(async () => {
  splitValue(props.modelValue ?? []);
  await loadScopeGroups();
});
</script>

<template>
  <div v-loading="scopeLoading" class="w-full">
    <el-alert
      v-if="scopeError"
      type="warning"
      :closable="false"
      show-icon
      class="mb-2"
      :title="t('approvalRule.pathCatalogLoadFailed')"
    >
      <el-button link type="primary" @click="loadScopeGroups">
        {{ t("approvalRule.retry") }}
      </el-button>
    </el-alert>
    <el-alert
      v-else-if="!scopeLoading && !scopeGroups.length"
      type="info"
      :closable="false"
      show-icon
      class="mb-2"
      :title="t('approvalRule.pathCatalogEmpty')"
    />
    <el-select
      v-model="pathSelected"
      multiple
      filterable
      clearable
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="3"
      class="w-full"
      :placeholder="t('approvalRule.pathsPlaceholder')"
      @change="emitValue"
    >
      <el-option-group
        v-for="group in scopeGroups"
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
            <el-tag size="small" effect="plain">{{ option.method }}</el-tag>
            <span class="truncate">{{ option.label }}</span>
            <span class="ml-auto pl-4 text-xs text-(--el-text-color-secondary)">
              {{ option.path }}
            </span>
          </div>
        </el-option>
      </el-option-group>
    </el-select>
    <div class="el-form-item__help mt-1">
      {{ t("approvalRule.pathsTip") }}
    </div>
    <el-input
      v-model="customPaths"
      type="textarea"
      :rows="2"
      class="mt-2"
      :placeholder="t('approvalRule.pathsCustomTip')"
      @input="emitValue"
    />
  </div>
</template>
