<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { copyTextToClipboard } from "@pureadmin/utils";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import { menuApi } from "@/api/system/menu";
import type {
  MenuPermissionAuditItem,
  MenuPermissionAuditResult
} from "@/api/system/menu";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Refresh from "~icons/ep/refresh";
import CopyDocument from "~icons/ep/copy-document";
import Location from "~icons/ep/location";

/**
 * 菜单权限检测：只读展示「正向缺口 / 游离权限点 / 重复权限码」三类问题的分组表格。
 *
 * 数据一次拉取、前端只做渲染与本地化建议文案映射；不提供写操作，修复走既有的
 * 「自动批量添加权限」（缺口）或菜单编辑面（游离/重复），避免重复造轮子。
 */

const props = withDefaults(
  defineProps<{
    /** 定位到库内权限点（父级菜单页消费，展开并高亮对应节点） */
    onLocate?: (_pk: string) => void;
  }>(),
  { onLocate: undefined }
);

const { t } = useI18n();
const loading = ref(false);
const result = ref<MenuPermissionAuditResult | null>(null);

interface AuditGroup {
  key: string;
  label: string;
  type: "warning" | "danger" | "info";
  empty: string;
  rows: MenuPermissionAuditItem[];
}

const columns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "code",
    label: t("systemMenu.permissionCode"),
    minWidth: 190,
    showOverflowTooltip: true
  },
  { prop: "method", label: t("systemMenu.requestMethod"), width: 80 },
  {
    prop: "path",
    label: t("systemMenu.permissionPath"),
    minWidth: 220,
    showOverflowTooltip: true
  },
  {
    prop: "menu",
    label: t("systemMenu.menu"),
    minWidth: 130,
    showOverflowTooltip: true
  },
  {
    slot: "suggestion",
    label: t("systemMenu.permissionAudit.suggestion"),
    minWidth: 160
  },
  { slot: "actions", label: t("commonLabels.operation"), width: 170 }
]);

const groups = computed<AuditGroup[]>(() => [
  {
    key: "missing",
    label: t("systemMenu.permissionAudit.missing"),
    type: "warning",
    empty: t("systemMenu.permissionAudit.empty.missing"),
    rows: result.value?.missing ?? []
  },
  {
    key: "orphan",
    label: t("systemMenu.permissionAudit.orphan"),
    type: "danger",
    empty: t("systemMenu.permissionAudit.empty.orphan"),
    rows: result.value?.orphan ?? []
  },
  {
    key: "duplicate",
    label: t("systemMenu.permissionAudit.duplicate"),
    type: "info",
    empty: t("systemMenu.permissionAudit.empty.duplicate"),
    rows: result.value?.duplicate ?? []
  }
]);

/** 建议文案：后端下发稳定的 suggestion 枚举，本地化在展示层完成 */
const suggestText = (value: MenuPermissionAuditItem["suggestion"]) => {
  const map = {
    generate: t("systemMenu.permissionAudit.suggest.generate"),
    verify: t("systemMenu.permissionAudit.suggest.verify"),
    merge: t("systemMenu.permissionAudit.suggest.merge")
  };
  return map[value] ?? value;
};

const fetchAudit = async () => {
  loading.value = true;
  try {
    const res = await menuApi.permissionAudit();
    if (res.code === SUCCESS_CODE) {
      result.value = res.data ?? null;
    } else {
      result.value = null;
      message(`${t("results.failed")}，${res.detail}`, { type: "error" });
    }
  } catch (error) {
    result.value = null;
    message(String((error as { detail?: string })?.detail ?? error), {
      type: "error"
    });
  } finally {
    loading.value = false;
  }
};

onMounted(fetchAudit);

/** 复制权限码（复用全局复制提示，失败给出可读原因） */
const onCopy = (value: string) => {
  if (!value) return;
  const ok = copyTextToClipboard(value);
  message(transformI18n(ok ? "results.copySuccess" : "results.copyFailed"), {
    type: ok ? "success" : "error"
  });
};

const onLocateRow = (pk: string | null) => {
  if (pk && props.onLocate) props.onLocate(pk);
};
</script>

<template>
  <div v-loading="loading" class="menu-audit">
    <div class="menu-audit__head">
      <span v-if="result" class="menu-audit__summary">
        {{
          t("systemMenu.permissionAudit.summary", {
            routes: result.summary.routes,
            permissions: result.summary.permissions,
            total: result.summary.total
          })
        }}
      </span>
      <el-button
        size="small"
        :icon="useRenderIcon(Refresh)"
        @click="fetchAudit"
      >
        {{ t("buttons.reload") }}
      </el-button>
    </div>

    <el-alert
      v-if="result && result.summary.total === 0"
      :closable="false"
      show-icon
      type="success"
      :title="t('systemMenu.permissionAudit.allClear')"
    />

    <section v-for="group in groups" :key="group.key" class="menu-audit__group">
      <div class="menu-audit__group-head">
        <span class="menu-audit__group-title">{{ group.label }}</span>
        <el-tag :type="group.type" effect="light" size="small">
          {{ group.rows.length }}
        </el-tag>
      </div>
      <ReReadonlyTable
        :columns="columns"
        :empty-text="group.empty"
        :max-height="220"
        :rows="group.rows"
        size="small"
      >
        <template #suggestion="{ row: item }">
          {{ suggestText(item.suggestion) }}
        </template>
        <template #actions="{ row: item }">
          <el-button
            v-if="item.code"
            link
            size="small"
            :icon="useRenderIcon(CopyDocument)"
            @click="onCopy(item.code)"
          >
            {{ t("systemMenu.action.copyCode") }}
          </el-button>
          <el-button
            v-if="item.pk"
            link
            size="small"
            :icon="useRenderIcon(Location)"
            @click="onLocateRow(item.pk)"
          >
            {{ t("systemMenu.permissionAudit.locate") }}
          </el-button>
        </template>
      </ReReadonlyTable>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.menu-audit {
  min-height: 200px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__summary {
    font-size: var(--el-font-size-small);
    color: var(--el-text-color-regular);
  }

  &__group {
    margin-top: 12px;
  }

  &__group-head {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }

  &__group-title {
    font-size: var(--el-font-size-base);
    font-weight: 600;
  }
}
</style>
