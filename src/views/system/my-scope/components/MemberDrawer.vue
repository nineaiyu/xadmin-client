<script lang="ts" setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { SUCCESS_CODE } from "@/api/types";
import { userApi } from "@/api/system/user";
import { formatDateTime } from "@/utils";
import type { ManagedDeptItem } from "@/api/system/dept";

/**
 * 我的管辖：部门成员预览抽屉（只读）。
 *
 * 数据源 `GET /api/system/user?dept=<pk>`（数据权限自动收敛到管辖范围），
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

const loading = ref(false);
const rows = ref<MemberRow[]>([]);
const total = ref(0);
const page = ref(1);
const PAGE_SIZE = 10;

const displayName = (row: Partial<MemberRow> | undefined) =>
  row?.nickname || row?.username || "-";

const loadMembers = async () => {
  if (!props.dept) return;
  loading.value = true;
  try {
    // 异常归一为失败结果：HTTP 层错误与业务失败走同一分支提示
    const res = await userApi
      .list({
        dept: props.dept.pk,
        page: page.value,
        size: PAGE_SIZE
      })
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      rows.value = (res.data?.results ?? []) as MemberRow[];
      total.value = res.data?.total ?? rows.value.length;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    loading.value = false;
  }
};

/** 页脚跳转：带部门筛选进入用户管理（数据权限自动收敛到管辖范围） */
const goUserPage = () => {
  if (!props.dept) return;
  visible.value = false;
  router.push({ name: "SystemUser", query: { dept: props.dept.pk } });
};

watch(visible, open => {
  if (open) {
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
    size="560px"
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
          v-model:current-page="page"
          layout="prev, pager, next"
          size="small"
          :total="total"
          :page-size="PAGE_SIZE"
          @current-change="loadMembers"
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
