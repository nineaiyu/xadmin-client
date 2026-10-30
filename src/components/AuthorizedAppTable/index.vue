<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import DataTable from "@/components/DataTable";
import type { AuthorizedApplication } from "@/api/user/authorizedApp";
import { formatDateTime } from "@/utils/format";

/**
 * 已授权应用表格（管理端 / 个人端共用）。
 *
 * 数据源与撤销语义两端不同（管理端撤全量授权、个人端只撤本人），由调用方
 * 通过 props/事件注入；列定义与状态标签收敛在此，避免两份逐字同构的表格。
 * showUserCount 仅管理端开启（聚合视图带用户数与 tooltip）。
 */
defineOptions({ name: "AuthorizedAppTable" });

withDefaults(
  defineProps<{
    rows: AuthorizedApplication[];
    loading: boolean;
    revokingPk: string;
    /** 表格可访问性标题（管理端 / 个人端词条不同） */
    label: string;
    showUserCount?: boolean;
    canRevoke?: boolean;
  }>(),
  { showUserCount: false, canRevoke: true }
);

const emit = defineEmits<{ revoke: [row: AuthorizedApplication] }>();

const { t } = useI18n();

const statusType = (status: AuthorizedApplication["status"]) => {
  if (status === "active") return "success";
  if (status === "expired") return "warning";
  return "info";
};
</script>

<template>
  <DataTable v-loading="loading" :data="rows" :label="label">
    <el-table-column :label="t('authorizedApps.application')" min-width="200">
      <template #default="{ row }">
        <div class="font-medium">{{ row.application.name }}</div>
        <div class="text-sm text-(--el-text-color-secondary)">
          {{ row.application.client_id }}
        </div>
      </template>
    </el-table-column>
    <el-table-column
      v-if="showUserCount"
      :label="t('authorizedApps.userCount')"
      width="110"
    >
      <template #default="{ row }">
        <el-tooltip
          v-if="row.user_count"
          :content="
            row.users
              .map((user: { username: string }) => user.username)
              .join(', ')
          "
        >
          <span>{{ row.user_count }}</span>
        </el-tooltip>
        <span v-else>0</span>
      </template>
    </el-table-column>
    <el-table-column :label="t('authorizedApps.scopes')" min-width="200">
      <template #default="{ row }">
        <el-tag
          v-for="scope in row.scopes"
          :key="scope"
          size="small"
          class="mr-1 mb-1"
        >
          {{ scope }}
        </el-tag>
        <span
          v-if="row.scopes.length === 0"
          class="text-sm text-(--el-text-color-secondary)"
        >
          {{ t("authorizedApps.noScopes") }}
        </span>
      </template>
    </el-table-column>
    <el-table-column
      :label="t('authorizedApps.authorizedTime')"
      min-width="170"
    >
      <template #default="{ row }">
        {{ formatDateTime(row.authorized_time) }}
      </template>
    </el-table-column>
    <el-table-column :label="t('authorizedApps.lastUsed')" min-width="170">
      <template #default="{ row }">
        {{ formatDateTime(row.last_used_time) }}
      </template>
    </el-table-column>
    <el-table-column :label="t('authorizedApps.status')" width="110">
      <template #default="{ row }">
        <el-tag :type="statusType(row.status)" size="small">
          {{ t(`authorizedApps.status_${row.status}`) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      v-if="canRevoke"
      :label="t('authorizedApps.actions')"
      width="130"
      fixed="right"
    >
      <template #default="{ row }">
        <el-button
          type="danger"
          link
          :loading="revokingPk === row.application.pk"
          @click="emit('revoke', row as AuthorizedApplication)"
        >
          {{ t("authorizedApps.revoke") }}
        </el-button>
      </template>
    </el-table-column>
  </DataTable>
</template>
