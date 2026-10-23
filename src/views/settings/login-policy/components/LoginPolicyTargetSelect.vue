<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { searchRoleApi, searchUserApi } from "@/api/system/search";

/**
 * 登录策略目标选择器：按 target_type 远程搜索用户名 / 角色 code。
 *
 * 存储值仍是逗号分隔字符串（后端 match_target 语义不变），选择器只负责
 * 把「手输 + 拼写错误静默失效」换成可搜索、可回显的受控输入。
 */
defineOptions({ name: "LoginPolicyTargetSelect" });

const props = defineProps<{
  modelValue?: string;
  targetType: "all" | "user" | "role";
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const { t } = useI18n();

type Option = { value: string; label: string };
const options = ref<Option[]>([]);
const loading = ref(false);

const selected = computed(() =>
  String(props.modelValue ?? "")
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean)
);
const isAll = computed(() => props.targetType === "all");

/** 历史值先落入候选，避免编辑时下拉只显示裸值 */
const seedOptions = () => {
  const map = new Map(options.value.map(item => [item.value, item]));
  selected.value.forEach(value => {
    if (!map.has(value)) {
      map.set(value, { value, label: value });
    }
  });
  options.value = [...map.values()];
};

watch(
  () => [props.targetType, props.modelValue],
  () => seedOptions(),
  { immediate: true }
);

watch(
  () => props.targetType,
  () => {
    options.value = [];
    if (props.modelValue) emit("update:modelValue", "");
  }
);

const update = (values: string[]) => {
  emit("update:modelValue", values.join(","));
};

const remoteSearch = async (keyword: string) => {
  const query = keyword.trim();
  if (!query) return;
  loading.value = true;
  try {
    const res =
      props.targetType === "role"
        ? await searchRoleApi.list({ code: query, page_size: 20 })
        : await searchUserApi.list({ username: query, page_size: 20 });
    if (!isSuccess(res)) return;
    const rows =
      (res.data as { results?: Record<string, unknown>[] })?.results ?? [];
    options.value = rows.map(row => {
      if (props.targetType === "role") {
        const code = String(row.code ?? "");
        return { value: code, label: `${row.name ?? code} (${code})` };
      }
      const username = String(row.username ?? "");
      return {
        value: username,
        label: row.nickname ? `${row.nickname} (${username})` : username
      };
    });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <el-input
    v-if="isAll"
    :model-value="t('loginPolicy.targetAllUsers')"
    disabled
  />
  <el-select
    v-else
    :model-value="selected"
    multiple
    filterable
    remote
    reserve-keyword
    clearable
    collapse-tags
    :remote-method="remoteSearch"
    :loading="loading"
    :placeholder="t('loginPolicy.targetValuePlaceholder')"
    @update:model-value="update"
  >
    <el-option
      v-for="item in options"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    />
  </el-select>
</template>
