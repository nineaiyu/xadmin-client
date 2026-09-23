<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { cloneDeep } from "@pureadmin/utils";
import { savedViewApi } from "@/api/system/security";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import View from "~icons/ep/view";

/**
 * 列表「我的视图」：把当前搜索区的筛选条件保存为命名视图，
 * 一键套用 / 设默认 / 删除；共享视图同页其他用户可见（只读应用）。
 *
 * 页面侧只需传「当前搜索条件快照」并监听 apply —— 应用逻辑由 RePlusPage
 * 写入 searchFields 后刷新，组件不直接操作搜索区（保持单向数据流）。
 */
const props = defineProps<{ conditions?: RecordType }>();
const emit = defineEmits<{ apply: [conditions: RecordType] }>();

const { t } = useI18n();
const route = useRoute();
const rows = ref<RecordType[]>([]);
const loading = ref(false);
const currentPk = ref<string | number>("");

const pageKey = computed(() => route.path);

/** 只保留有值的筛选条件（剔除分页与空值，避免把无用条件存进视图） */
const cleanConditions = (source: RecordType | undefined) => {
  const result: RecordType = {};
  Object.entries(source ?? {}).forEach(([key, value]) => {
    if (["page", "size", "ordering"].includes(key)) return;
    if (value === "" || value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    result[key] = cloneDeep(value);
  });
  return result;
};

const hasActiveConditions = computed(
  () => Object.keys(cleanConditions(props.conditions)).length > 0
);

const load = async () => {
  loading.value = true;
  try {
    const res = await savedViewApi.list({
      page: 1,
      size: 100,
      page_key: pageKey.value
    });
    rows.value = res.code === 1000 ? (res.data?.results ?? []) : [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

const applyView = (row: RecordType, silent = false) => {
  currentPk.value = row.pk;
  emit("apply", cloneDeep(row.conditions ?? {}));
  if (!silent) {
    ElMessage.success(t("savedView.applied", { name: row.name }));
  }
};

const saveView = async () => {
  if (!hasActiveConditions.value) {
    ElMessage.warning(t("savedView.emptyConditions"));
    return;
  }
  let name = "";
  try {
    const input = await ElMessageBox.prompt(
      t("savedView.namePlaceholder"),
      t("savedView.saveTitle"),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        inputValue: ""
      }
    );
    name = String(input.value ?? "").trim();
  } catch {
    return;
  }
  if (!name) return;
  const res = await savedViewApi.create({
    page_key: pageKey.value,
    name,
    conditions: cleanConditions(props.conditions)
  });
  if (res.code === 1000) {
    ElMessage.success(t("savedView.saveSuccess"));
    await load();
  } else {
    ElMessage.error(String(res.detail));
  }
};

const setDefault = async (row: RecordType) => {
  const res = await savedViewApi.partialUpdate(row.pk, { is_default: true });
  if (res.code === 1000) {
    await load();
  } else {
    ElMessage.error(String(res.detail));
  }
};

const remove = async (row: RecordType) => {
  try {
    await ElMessageBox.confirm(
      t("savedView.deleteConfirm", { name: row.name }),
      t("buttons.tips"),
      {
        type: "warning",
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel")
      }
    );
  } catch {
    return;
  }
  const res = await savedViewApi.destroy(row.pk);
  if (res.code === 1000) {
    if (currentPk.value === row.pk) currentPk.value = "";
    await load();
  } else {
    ElMessage.error(String(res.detail));
  }
};

onMounted(async () => {
  await load();
  // 默认视图：仅在当前没有任何筛选条件时静默套用（避免覆盖用户手输条件）
  const defaultView = rows.value.find(item => item.is_default);
  if (defaultView && !hasActiveConditions.value) {
    applyView(defaultView, true);
  }
});

defineExpose({ reload: load });
</script>

<template>
  <el-dropdown trigger="click" class="mr-3">
    <el-button :icon="useRenderIcon(View)" :loading="loading">
      {{ t("savedView.button") }}
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-if="!rows.length" disabled>
          {{ t("savedView.empty") }}
        </el-dropdown-item>
        <el-dropdown-item
          v-for="row in rows"
          :key="row.pk"
          @click="applyView(row)"
        >
          <span class="mr-2">{{ row.name }}</span>
          <el-tag v-if="row.is_default" size="small" type="success">
            {{ t("savedView.default") }}
          </el-tag>
          <el-tag v-if="row.is_shared" size="small" type="info">
            {{ t("savedView.sharedShort") }}
          </el-tag>
          <el-button
            v-if="!row.is_default"
            class="ml-2"
            link
            type="primary"
            size="small"
            @click.stop="setDefault(row)"
          >
            {{ t("savedView.setDefault") }}
          </el-button>
          <el-button
            class="ml-2"
            link
            type="danger"
            size="small"
            @click.stop="remove(row)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </el-dropdown-item>
        <el-dropdown-item divided @click="saveView">
          {{ t("savedView.save") }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
