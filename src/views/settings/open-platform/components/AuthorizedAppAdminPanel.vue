<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import {
  authorizedApplicationApi,
  type AuthorizedApplication
} from "@/api/user/authorizedApp";
import { useConfirm } from "@/hooks/useConfirm";
import { formatDateTime } from "@/utils/format";
import { message } from "@/utils/message";

defineOptions({ name: "AuthorizedAppAdminPanel" });

defineProps<{
  canRead: boolean;
  canRevoke: boolean;
}>();

const { t } = useI18n();
const confirm = useConfirm();
const rows = ref<AuthorizedApplication[]>([]);
const loading = ref(false);
const revoking = ref("");

const load = async () => {
  loading.value = true;
  try {
    const res = await authorizedApplicationApi.list<AuthorizedApplication>();
    if (isSuccess(res)) {
      rows.value = res.data?.results ?? [];
    }
  } catch {
    // 网络错误由统一拦截器提示
  } finally {
    loading.value = false;
  }
};

const revoke = async (row: AuthorizedApplication) => {
  const ok = await confirm(
    t("authorizedApps.revokeAllConfirm", { name: row.application.name }),
    { danger: true }
  );
  if (!ok) return;
  revoking.value = row.application.pk;
  try {
    const res = await authorizedApplicationApi.revoke(row.application.pk);
    if (isSuccess(res)) {
      message(t("authorizedApps.revokedAll"), { type: "success" });
      await load();
    } else if (res.detail) {
      message(res.detail, { type: "warning" });
    }
  } finally {
    revoking.value = "";
  }
};

const statusType = (status: AuthorizedApplication["status"]) => {
  if (status === "active") return "success";
  if (status === "expired") return "warning";
  return "info";
};

onMounted(load);
</script>

<template>
  <el-empty
    v-if="!canRead"
    data-testid="authorized-admin-no-permission"
    :description="t('setting.noPermission')"
  />
  <div v-else class="space-y-3">
    <el-table
      v-loading="loading"
      :data="rows"
      data-testid="authorized-admin-table"
    >
      <el-table-column :label="t('authorizedApps.application')" min-width="200">
        <template #default="{ row }">
          <div class="font-medium">{{ row.application.name }}</div>
          <div class="text-sm text-(--el-text-color-secondary)">
            {{ row.application.client_id }}
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('authorizedApps.userCount')" width="110">
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
            :loading="revoking === row.application.pk"
            @click="revoke(row as AuthorizedApplication)"
          >
            {{ t("authorizedApps.revoke") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty
      v-if="!loading && rows.length === 0"
      :description="t('authorizedApps.empty')"
    />
  </div>
</template>
