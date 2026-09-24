<script lang="ts" setup>
import { computed, h, onMounted, ref, watch, type Component } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { cloneDeep } from "@pureadmin/utils";
import View from "~icons/ep/view";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useUserStoreHook } from "@/store/modules/user";
import { savedViewApi } from "@/api/system/security";
import type { DetailResult } from "@/api/types";
import type { RecordType } from "plus-pro-components";
import type { PageColumn } from "../utils/types";
import SavedViewMenu from "./SavedViewMenu.vue";
import {
  cleanViewConditions,
  hasViewConditions,
  sortViews,
  type SavedViewRow
} from "../utils/savedView";

/**
 * 列表「我的视图」：把当前搜索区的筛选条件保存为命名视图，
 * 一键套用 / 用当前筛选更新 / 重命名 / 另存副本 / 设默认 / 删除；
 * 共享视图同页其他用户可见（只读应用）。
 *
 * 页面侧只需传「当前搜索条件快照」并监听 apply —— 应用逻辑由 RePlusPage
 * 写入 searchFields 后刷新，组件不直接操作搜索区（保持单向数据流）。
 */
const props = defineProps<{
  conditions?: RecordType;
  /**
   * 列表元数据是否已就绪（RePlusPage 的 searchMetaReady）。
   *
   * 默认视图的静默套用必须等到元数据就绪后再执行：首开请求（with_meta=1）在途时
   * 追加的筛选请求会把首包响应从「请求序号」上顶掉，首包里的列元数据随之被丢弃
   * （表现为表格无列 + 元数据缺失警示条，只有分页总数正确）。
   */
  ready?: boolean;
  /** 列表列元数据：用于把条件翻译成可读摘要（字段 / 选项标签） */
  columns?: PageColumn[];
}>();
const emit = defineEmits<{ apply: [conditions: RecordType] }>();

const { t } = useI18n();
const route = useRoute();
const userStore = useUserStoreHook();
const rows = ref<SavedViewRow[]>([]);
const loading = ref(false);
const visible = ref(false);
const currentPk = ref<string | number>("");

const pageKey = computed(() => route.path);
const username = computed(() => String(userStore.username ?? ""));
const views = computed(() => sortViews(rows.value, username.value));
/** 当前生效的视图名（应用 / 保存后按钮上显示，用户可感知列表来自哪个视图） */
const activeName = computed(
  () =>
    rows.value.find(item => String(item.pk) === String(currentPk.value))
      ?.name ?? ""
);
const currentConditions = computed(() =>
  cleanViewConditions(props.conditions as Record<string, unknown>)
);

// 搜索条件被清空（重置 / 清筛选）后不再对应任何视图，按钮回到默认态
watch(
  () => hasViewConditions(props.conditions as Record<string, unknown>),
  active => {
    if (!active) currentPk.value = "";
  }
);

const load = async () => {
  loading.value = true;
  try {
    const res = await savedViewApi.list({
      page: 1,
      size: 100,
      page_key: pageKey.value
    });
    rows.value =
      res.code === 1000 ? ((res.data?.results ?? []) as SavedViewRow[]) : [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

const applyView = (row: SavedViewRow, silent = false) => {
  currentPk.value = row.pk;
  visible.value = false;
  emit("apply", cloneDeep(row.conditions ?? {}) as RecordType);
  if (!silent) {
    ElMessage.success(t("savedView.applied", { name: row.name }));
  }
};

/** 请求异常归一：HTTP 层错误也要落到业务码分支（否则弹窗 loading 悬挂） */
const fallback = (
  error: { detail?: string } | undefined
): DetailResult<RecordType> => ({
  code: -1,
  detail: error?.detail ?? String(t("results.failed")),
  data: {}
});

let formComponent: Component | null = null;

type FormMode = "create" | "edit" | "duplicate";

/** 保存 / 编辑 / 另存副本：共用同一表单组件（懒加载，不进首屏闭包） */
const openForm = async (
  mode: FormMode,
  options: {
    row?: SavedViewRow;
    conditions?: Record<string, unknown>;
    defaultName?: string;
  } = {}
) => {
  if (!formComponent) {
    formComponent = (await import("./SavedViewForm.vue")).default;
  }
  const formRef = ref();
  const conditions = options.conditions ?? currentConditions.value;
  const titles: Record<FormMode, string> = {
    create: t("savedView.saveTitle"),
    edit: t("savedView.editTitle"),
    duplicate: t("savedView.duplicateTitle")
  };
  visible.value = false;
  addDialog({
    title: titles[mode],
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(formComponent!, {
        ref: formRef,
        row: mode === "edit" ? options.row : undefined,
        conditions,
        columns: props.columns,
        defaultName: options.defaultName
      }),
    beforeSure: async done => {
      const payload = formRef.value?.getPayload?.();
      if (!payload) return;
      const request =
        mode === "edit" && options.row
          ? savedViewApi.partialUpdate(options.row.pk, payload)
          : savedViewApi.create({
              page_key: pageKey.value,
              conditions,
              ...payload
            });
      const res = await request.catch(fallback);
      if (res.code !== 1000) {
        ElMessage.error(String(res.detail ?? t("results.failed")));
        return;
      }
      currentPk.value =
        mode === "edit" && options.row ? options.row.pk : (res.data?.pk ?? "");
      done();
      await load();
      ElMessage.success(t("savedView.saveSuccess"));
    }
  });
};

const save = () => {
  if (!hasViewConditions(props.conditions as Record<string, unknown>)) {
    ElMessage.warning(t("savedView.emptyConditions"));
    return;
  }
  return openForm("create");
};

const rename = (row: SavedViewRow) =>
  openForm("edit", { row, conditions: row.conditions ?? {} });

const duplicate = (row: SavedViewRow) =>
  openForm("duplicate", {
    row,
    conditions: row.conditions ?? {},
    defaultName: `${row.name}${t("savedView.copySuffix")}`
  });

/** 用当前搜索条件覆盖该视图（本人视图） */
const updateWithCurrent = async (row: SavedViewRow) => {
  const conditions = currentConditions.value;
  if (!Object.keys(conditions).length) {
    ElMessage.warning(t("savedView.emptyConditions"));
    return;
  }
  const res = await savedViewApi
    .partialUpdate(row.pk, { conditions })
    .catch(fallback);
  if (res.code === 1000) {
    ElMessage.success(t("savedView.updated", { name: row.name }));
    await load();
  } else {
    ElMessage.error(String(res.detail ?? t("results.failed")));
  }
};

const toggleDefault = async (row: SavedViewRow) => {
  const res = await savedViewApi
    .partialUpdate(row.pk, { is_default: !row.is_default })
    .catch(fallback);
  if (res.code === 1000) {
    await load();
    ElMessage.success(
      row.is_default ? t("savedView.defaultCleared") : t("savedView.defaultSet")
    );
  } else {
    ElMessage.error(String(res.detail ?? t("results.failed")));
  }
};

const remove = async (row: SavedViewRow) => {
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
  const res = await savedViewApi.destroy(row.pk).catch(fallback);
  if (res.code === 1000) {
    if (String(currentPk.value) === String(row.pk)) currentPk.value = "";
    await load();
  } else {
    ElMessage.error(String(res.detail ?? t("results.failed")));
  }
};

/** 默认视图：仅在当前没有任何筛选条件时静默套用（避免覆盖用户手输条件） */
const applyDefaultView = () => {
  if (!props.ready || currentPk.value) return;
  const defaultView = rows.value.find(item => item.is_default);
  if (
    defaultView &&
    !hasViewConditions(props.conditions as Record<string, unknown>)
  ) {
    applyView(defaultView, true);
  }
};

onMounted(async () => {
  await load();
  applyDefaultView();
});

// 元数据就绪晚于视图列表加载：就绪后再补一次（早于就绪时套用会破坏首包元数据）
watch(
  () => props.ready,
  ready => {
    if (ready) applyDefaultView();
  }
);

defineExpose({ reload: load });
</script>

<template>
  <el-popover
    v-model:visible="visible"
    trigger="click"
    :width="400"
    placement="bottom-start"
    popper-class="saved-view-popover"
    @before-enter="load"
  >
    <template #reference>
      <el-button
        :icon="View"
        :loading="loading"
        :type="activeName ? 'primary' : ''"
        :plain="!!activeName"
        class="mr-3"
        data-testid="saved-view-trigger"
      >
        <span class="inline-block max-w-40 truncate align-middle">{{
          activeName || t("savedView.button")
        }}</span>
        <span
          v-if="!activeName && rows.length"
          class="ml-1 text-xs text-text_color_secondary"
        >
          ({{ rows.length }})
        </span>
      </el-button>
    </template>
    <saved-view-menu
      :views="views"
      :current-pk="currentPk"
      :columns="columns"
      :username="username"
      @apply="applyView"
      @save="save"
      @update="updateWithCurrent"
      @rename="rename"
      @duplicate="duplicate"
      @toggle-default="toggleDefault"
      @remove="remove"
    />
  </el-popover>
</template>
