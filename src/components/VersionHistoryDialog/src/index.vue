<script lang="ts" setup>
import OverlayDialog from "@/components/overlay/OverlayDialog.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import { formatDateTime } from "@/utils/format";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
import { dialogSize } from "@/components/ReDialog/size";
import type { VersionHistoryRow } from "./types";

defineOptions({ name: "VersionHistoryDialog" });

/**
 * 版本历史弹窗（报表设计 / 大屏布局共用）。
 *
 * 自取自管：打开时调用 `load` 拉历史版本（失败给可读提示），列表只读；回滚走
 * `rollback` 事件由组合层执行（成功后关闭，历史由服务端新增一版）。
 * 版本内容是业务载荷，弹窗只负责选择版本，不解析载荷。
 */
const props = defineProps<{
  modelValue: boolean;
  title: string;
  load: () => Promise<VersionHistoryRow[]>;
  /** 附加列文案（如「组件数」/「画布模式」），不传则不展示 */
  metaLabel?: string;
  metaText?: (_row: VersionHistoryRow) => string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  rollback: [version: number];
}>();

const { t } = useI18n();
const confirm = useConfirm();
const rows = ref<VersionHistoryRow[]>([]);
const loading = ref(false);

async function reload() {
  loading.value = true;
  try {
    rows.value = await props.load();
  } catch {
    rows.value = [];
    message(t("versionHistory.loadFailed"), { type: "warning" });
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  visible => {
    if (visible) void reload();
  }
);

const formatTime = (value?: string) => formatDateTime(value);

const columns = computed<ReadonlyColumn[]>(() => {
  const base: ReadonlyColumn[] = [
    {
      prop: "version",
      label: t("versionHistory.version"),
      width: 80
    }
  ];
  if (props.metaLabel) {
    base.push({ label: props.metaLabel, minWidth: 120, slot: "meta" });
  }
  base.push(
    { label: t("versionHistory.time"), width: 170, slot: "time" },
    { label: t("versionHistory.rollback"), width: 110, slot: "actions" }
  );
  return base;
});

async function onRollback(row: VersionHistoryRow) {
  if (
    !(await confirm(t("versionHistory.rollbackConfirm", { n: row.version }), {
      title: props.title,
      confirmButtonText: t("versionHistory.rollback"),
      danger: true
    }))
  ) {
    return;
  }
  emit("rollback", row.version);
}
</script>

<template>
  <OverlayDialog
    :model-value="modelValue"
    :title="title"
    :width="dialogSize('md')"
    data-testid="version-history-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ReReadonlyTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :empty-text="t('versionHistory.empty')"
      size="small"
      max-height="360"
    >
      <template v-if="metaLabel" #meta="{ row }">
        {{ metaText?.(row as VersionHistoryRow) ?? "" }}
      </template>
      <template #time="{ row }">
        {{ formatTime(row.created_time as string | undefined) }}
      </template>
      <template #actions="{ row }">
        <el-button
          size="small"
          :data-testid="`version-rollback-${row.version}`"
          @click="onRollback(row as VersionHistoryRow)"
        >
          {{ t("versionHistory.rollback") }}
        </el-button>
      </template>
    </ReReadonlyTable>
  </OverlayDialog>
</template>
