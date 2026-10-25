<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AuthorizedAppTable from "@/components/AuthorizedAppTable";
import { useAuthorizedAppList } from "@/components/AuthorizedAppTable/useAuthorizedAppList";
import { authorizedApplicationApi } from "@/api/user/authorizedApp";

/**
 * 开放平台「授权应用管理」（管理员审计视角）：全部用户的 OAuth 授权按应用
 * 聚合，可整应用撤销。列与撤销链路由 AuthorizedAppTable / useAuthorizedAppList
 * 与个人中心共享；本面板只注入管理端 API、用户数列与权限门。
 */
defineOptions({ name: "AuthorizedAppAdminPanel" });

const props = defineProps<{
  canRead: boolean;
  canRevoke: boolean;
}>();

const { t } = useI18n();
const { rows, loading, revoking, load, revoke } = useAuthorizedAppList({
  api: {
    list: () => authorizedApplicationApi.list(),
    revoke: pk => authorizedApplicationApi.revoke(pk)
  },
  // 管理端撤销语义：撤的是该应用的**全部用户**授权（区别于个人端只撤本人）
  confirmKey: "authorizedApps.revokeAllConfirm",
  successKey: "authorizedApps.revokedAll"
});

onMounted(() => {
  if (props.canRead) load();
});
</script>

<template>
  <ReEmpty
    v-if="!canRead"
    data-testid="authorized-admin-no-permission"
    :description="t('setting.noPermission')"
  />
  <div v-else class="space-y-3">
    <AuthorizedAppTable
      :rows="rows"
      :loading="loading"
      :revoking-pk="revoking"
      :label="t('settingOpenPlatform.authorized')"
      :show-user-count="true"
      :can-revoke="canRevoke"
      data-testid="authorized-admin-table"
      @revoke="revoke"
    />
    <ReEmpty
      v-if="!loading && rows.length === 0"
      :description="t('authorizedApps.empty')"
    />
  </div>
</template>
