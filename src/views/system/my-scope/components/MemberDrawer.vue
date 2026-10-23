<script lang="ts" setup>
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { usePagedList } from "@/hooks/usePagedList";
import { userApi } from "@/api/identity/user";
import { formatDateTime } from "@/utils";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
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

/** 只读列：复杂渲染走具名插槽，与凭据页等只读表保持同一形态 */
const columns = computed<ReadonlyColumn[]>(() => [
  {
    label: t("systemMyScope.colUser"),
    minWidth: 120,
    slot: "user",
    showOverflowTooltip: true
  },
  {
    label: t("systemMyScope.colNickname"),
    minWidth: 120,
    slot: "nickname",
    showOverflowTooltip: true
  },
  {
    label: t("systemMyScope.colStatus"),
    width: 80,
    align: "center",
    slot: "status"
  },
  {
    label: t("systemMyScope.colLastLogin"),
    minWidth: 160,
    slot: "lastLogin"
  }
]);

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

/** 分页信息交给只读表统一渲染，翻页仍由本组件拉取 */
const pagination = computed(() => ({
  total: total.value,
  page: page.value,
  pageSize: PAGE_SIZE
}));

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
    <div class="flex flex-col h-full">
      <div class="flex-bc mb-2">
        <span class="text-sm text-(--el-text-color-secondary)">
          {{ t("systemMyScope.membersTotal", { total }) }}
        </span>
      </div>
      <ReReadonlyTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :pagination="pagination"
        size="small"
        border
        class="flex-1"
        @page-change="setPage"
      >
        <template #user="{ row }">
          <el-text class="w-full" truncated>{{ row.username }}</el-text>
        </template>
        <template #nickname="{ row }">
          <el-text class="w-full" truncated>{{ displayName(row) }}</el-text>
        </template>
        <template #status="{ row }">
          <el-tag size="small" :type="row.is_active ? 'success' : 'info'">
            {{
              row.is_active
                ? t("systemMyScope.active")
                : t("systemMyScope.disabled")
            }}
          </el-tag>
        </template>
        <template #lastLogin="{ row }">
          {{ formatDateTime(row.last_login) || "-" }}
        </template>
      </ReReadonlyTable>
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
