<script lang="ts" setup>
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { usePagedList } from "@/hooks/usePagedList";
import { userApi } from "@/api/identity/user";
import { formatDateTime } from "@/utils";
import type { ManagedDeptItem } from "@/api/identity/dept";

import { drawerSize } from "@/components/ReDialog/size";
/**
 * 我的管辖：部门成员预览抽屉（只读）。
 *
 * 数据源 `GET /api/identity/user?dept=<pk>`（数据权限自动收敛到管辖范围），
 * 仅在具备用户列表权限时可用；页脚跳转「用户管理」继续操作。
 */
defineOptions({ name: "SystemMyScopeMemberDrawer" });

const props = defineProps<{
  /** 当前预览的部门（null = 关闭态） */
  dept: ManagedDeptItem | null;
}>();

const visible = defineModel<boolean>({ default: false });

const { t } = useI18n();
const router = useRouter();

interface MemberRow {
  pk: number | string;
  username: string;
  nickname: string;
  is_active: boolean;
  last_login: string | null;
}

const PAGE_SIZE = 10;

const displayName = (row: Partial<MemberRow> | undefined) =>
  row?.nickname || row?.username || "-";

// 成员分页（异常归一与信封判定见 usePagedList；失败经 onFail 统一提示）
const {
  loading,
  page,
  total,
  rows,
  load: loadMembers,
  setPage
} = usePagedList<MemberRow>({
  pageSize: PAGE_SIZE,
  fetch: params => userApi.list({ dept: props.dept?.pk, ...params }),
  pickRows: res =>
    (res.data as { results?: MemberRow[] } | null)?.results ?? [],
  onFail: res => {
    if (res.detail) message(String(res.detail), { type: "warning" });
  }
});

/** 页脚跳转：带部门筛选进入用户管理（数据权限自动收敛到管辖范围） */
const goUserPage = () => {
  if (!props.dept) return;
  visible.value = false;
  router.push({ name: "SystemUser", query: { dept: props.dept.pk } });
};

watch(visible, open => {
  if (open && props.dept) {
    page.value = 1;
    rows.value = [];
    total.value = 0;
    loadMembers();
  }
});
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="
      dept
        ? t('systemMyScope.memberDrawerTitle', { dept: dept.name })
        : t('systemMyScope.viewMembers')
    "
    :size="drawerSize('md')"
    class="max-w-[92vw]!"
  >
    <div v-loading="loading" class="flex flex-col h-full">
      <div class="flex-bc mb-2">
        <span class="text-sm text-(--el-text-color-secondary)">
          {{ t("systemMyScope.membersTotal", { total }) }}
        </span>
      </div>
      <el-table :data="rows" size="small" class="flex-1">
        <el-table-column :label="t('systemMyScope.colUser')" min-width="120">
          <template #default="{ row }">
            <el-text class="w-full" truncated>{{ row.username }}</el-text>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('systemMyScope.colNickname')"
          min-width="120"
        >
          <template #default="{ row }">
            <el-text class="w-full" truncated>{{ displayName(row) }}</el-text>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('systemMyScope.colStatus')"
          width="80"
          align="center"
        >
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_active ? 'success' : 'info'">
              {{
                row.is_active
                  ? t("systemMyScope.active")
                  : t("systemMyScope.disabled")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('systemMyScope.colLastLogin')"
          min-width="160"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.last_login) || "-" }}
          </template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end mt-3">
        <el-pagination
          layout="prev, pager, next"
          size="small"
          :total="total"
          :page-size="PAGE_SIZE"
          :current-page="page"
          @current-change="setPage"
        />
      </div>
    </div>
    <template #footer>
      <el-button
        v-if="hasAuth('list:SystemUser')"
        type="primary"
        @click="goUserPage"
      >
        {{ t("systemMyScope.viewInUserPage") }}
      </el-button>
    </template>
  </el-drawer>
</template>
