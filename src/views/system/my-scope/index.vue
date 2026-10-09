<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { TreeV2Instance } from "element-plus";
import type { TreeNodeData } from "element-plus/es/components/tree-v2/src/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import { useFullHeightPanel } from "@/hooks/useFullHeightPanel";
import {
  deptApi,
  type ManagedDeptItem,
  type ManagedScopeResult,
  type ManagedUserRef
} from "@/api/identity/dept";
import { handleTree } from "@/utils/tree";
import { ReNormalCountTo } from "@/components/ReCountTo";
import Segmented from "@/components/ReSegmented";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import DeptIcon from "~icons/ep/office-building";
import DirectIcon from "~icons/ep/star";
import SubIcon from "~icons/ep/share";
import MembersIcon from "~icons/ep/user-filled";
import ViewIcon from "~icons/ep/view";
import UserIcon from "~icons/ep/user";
import SearchIcon from "~icons/ep/search";
import RefreshIcon from "~icons/ep/refresh-right";
import MemberDrawer from "./components/MemberDrawer.vue";

/**
 * 我的管辖（部门管理员视图）：本人任管理员的部门（含下级）与成员统计。
 *
 * 只读页——数据源 `GET /api/identity/dept/managed`（恒定本人范围，不随查询参数放大）；
 * 支持关键字检索、卡片/层级两种视图，点开部门可预览成员（数据权限自动收敛），
 * 并可跳转「用户管理」继续操作。
 */
defineOptions({ name: "SystemMyScope" });

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const scope = ref<ManagedScopeResult | null>(null);

const loadScope = async () => {
  loading.value = true;
  try {
    // 异常归一为失败结果：HTTP 层错误与业务失败走同一分支提示
    const res = await deptApi.managed().catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      scope.value = res.data;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    loading.value = false;
  }
};

/** 管辖部门清单（响应为空安全兜底） */
const depts = computed<ManagedDeptItem[]>(() => scope.value?.depts ?? []);

const directCount = computed(
  () => depts.value.filter(dept => dept.is_direct).length
);
const subCount = computed(() => depts.value.length - directCount.value);

/** pk → 部门名（卡片展示上级部门用） */
const nameById = computed(() => {
  const map = new Map<string, string>();
  depts.value.forEach(dept => map.set(dept.pk, dept.name));
  return map;
});

const canListUsers = computed(() => hasAuth("list:SystemUser"));

const userLabel = (user: ManagedUserRef) =>
  user.nickname ? `${user.nickname}(${user.username})` : user.username;

/** 管理员清单折叠展示：超出 2 人收敛为「+N」（悬浮提示全量） */
const foldUsers = (users: ManagedUserRef[]) => {
  const shown = users.slice(0, 2).map(userLabel);
  if (users.length > 2) {
    shown.push(`+${users.length - 2}`);
  }
  return shown.join("、");
};

// —— 关键字检索：卡片视图走内存过滤（超量收敛为「加载更多」），层级视图走树过滤 ——
const keyword = ref("");
const filteredDepts = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return depts.value;
  return depts.value.filter(
    dept =>
      dept.name?.toLowerCase().includes(value) ||
      dept.code?.toLowerCase().includes(value)
  );
});

/** 单次渲染上限（具名常量）：超量部门收敛为「加载更多」逐步放量 */
const RENDER_STEP = 200;
const renderLimit = ref(RENDER_STEP);
const visibleDepts = computed(() =>
  filteredDepts.value.slice(0, renderLimit.value)
);
const remainingCount = computed(
  () => filteredDepts.value.length - renderLimit.value
);
const loadMore = () => {
  renderLimit.value += RENDER_STEP;
};

// —— 视图切换 ——
// ReSegmented 的 v-model 为数字下标语义（非数字时仅维护内部选中态，不回写）
const viewMode = ref(0); // 0=卡片 1=层级
const isTreeView = computed(() => viewMode.value === 1);
const viewOptions = computed(() => [
  { label: t("systemMyScope.cardView"), value: "card" },
  { label: t("systemMyScope.treeView"), value: "tree" }
]);

interface ScopeTreeNode extends ManagedDeptItem {
  children?: ScopeTreeNode[];
}

/** 层级视图：按 parent_id 建树（父部门不在管辖内时视为根） */
const treeData = computed<ScopeTreeNode[]>(() =>
  handleTree<ManagedDeptItem>(depts.value, "pk", "parent_id", "children")
);

// —— 层级视图：虚拟树（el-tree-v2）+ 全量展开语义 ——
const { pageRef, panelHeight, measure } = useFullHeightPanel();
// 层级卡片切换挂载时机晚于 hook 首测，进入视图后重测一次贴合视口
watch(isTreeView, async value => {
  if (!value) return;
  await nextTick();
  measure();
});

const treeRef = ref<TreeV2Instance>();
const filterNode = (query: string, data: TreeNodeData) => {
  if (!query) return true;
  const keywordLower = query.toLowerCase();
  return (
    String(data.name ?? "")
      .toLowerCase()
      .includes(keywordLower) ||
    String(data.code ?? "")
      .toLowerCase()
      .includes(keywordLower)
  );
};
watch(keyword, value => {
  // 关键字变化重置卡片渲染上限，避免沿用旧上限的分页余量
  renderLimit.value = RENDER_STEP;
  treeRef.value?.filter(value);
});

/** 全量展开：tree-v2 无 default-expand-all，展开态即键集合（虚拟化下无性能负担）。
 *  default-expanded-keys 覆盖挂载态，数据晚到/刷新由 watch 补齐展开键 */
const allTreeKeys = computed(() => depts.value.map(dept => dept.pk));
watch(allTreeKeys, async () => {
  await nextTick();
  treeRef.value?.setExpandedKeys(allTreeKeys.value);
});

// —— 成员预览抽屉与跳转 ——
const drawerVisible = ref(false);
const activeDept = ref<ManagedDeptItem | null>(null);

const openMembers = (dept: ManagedDeptItem) => {
  if (!canListUsers.value) return;
  activeDept.value = dept;
  drawerVisible.value = true;
};

const goDeptUsers = (pk: string) => {
  if (!canListUsers.value) return;
  router.push({ name: "SystemUser", query: { dept: pk } });
};

onMounted(loadScope);
</script>

<template>
  <div v-loading="loading" class="main">
    <!-- 统计总览 -->
    <el-card shadow="never" class="mb-3">
      <div class="flex flex-wrap items-center gap-x-10 gap-y-4">
        <div class="flex items-center gap-3">
          <el-icon :size="28" class="text-(--el-color-primary)">
            <DeptIcon />
          </el-icon>
          <div>
            <div class="text-sm opacity-70">
              {{ t("systemMyScope.deptCount") }}
            </div>
            <ReNormalCountTo
              :endVal="scope?.dept_count ?? 0"
              :duration="800"
              font-size="1.4em"
              class="font-semibold"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <el-icon :size="28" class="text-(--el-color-warning)">
            <DirectIcon />
          </el-icon>
          <div>
            <div class="text-sm opacity-70">
              {{ t("systemMyScope.directCount") }}
            </div>
            <ReNormalCountTo
              :endVal="directCount"
              :duration="800"
              font-size="1.4em"
              class="font-semibold"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <el-icon :size="28" class="text-(--el-color-success)">
            <SubIcon />
          </el-icon>
          <div>
            <div class="text-sm opacity-70">
              {{ t("systemMyScope.subCount") }}
            </div>
            <ReNormalCountTo
              :endVal="subCount"
              :duration="800"
              font-size="1.4em"
              class="font-semibold"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <el-icon :size="28" class="text-(--el-color-danger)">
            <MembersIcon />
          </el-icon>
          <div>
            <div class="text-sm opacity-70">
              {{ t("systemMyScope.userCount") }}
            </div>
            <ReNormalCountTo
              :endVal="scope?.user_count ?? 0"
              :duration="800"
              font-size="1.4em"
              class="font-semibold"
            />
          </div>
        </div>
        <span class="text-xs text-(--el-text-color-secondary)">
          {{ t("systemMyScope.hint") }}
        </span>
      </div>
    </el-card>

    <!-- 工具栏：检索 / 视图切换 / 刷新 -->
    <el-card v-if="depts.length" shadow="never" class="mb-3" body-class="py-2!">
      <div class="flex flex-wrap items-center gap-3">
        <el-input
          v-model="keyword"
          clearable
          :placeholder="t('systemMyScope.searchPlaceholder')"
          :prefix-icon="useRenderIcon(SearchIcon)"
          class="max-w-60!"
        />
        <Segmented v-model="viewMode" :options="viewOptions" size="small" />
        <div class="ml-auto">
          <el-button
            circle
            :icon="useRenderIcon(RefreshIcon)"
            :title="t('systemMyScope.refresh')"
            :aria-label="t('systemMyScope.refresh')"
            @click="loadScope"
          />
        </div>
      </div>
    </el-card>

    <el-empty v-if="!depts.length" :description="t('systemMyScope.empty')" />
    <el-empty
      v-else-if="!isTreeView && !filteredDepts.length"
      :description="t('systemMyScope.searchEmpty')"
    />

    <!-- 卡片视图（渲染上限 + 加载更多） -->
    <template v-else-if="!isTreeView">
      <div class="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        <el-card
          v-for="dept in visibleDepts"
          :key="dept.pk"
          shadow="hover"
          data-testid="my-scope-dept"
        >
          <div class="flex-bc gap-2">
            <span class="font-medium truncate">{{ dept.name }}</span>
            <el-tag v-if="dept.is_direct" size="small" type="primary">
              {{ t("systemMyScope.direct") }}
            </el-tag>
          </div>
          <div class="mt-1 text-xs opacity-60">{{ dept.code }}</div>
          <div
            v-if="dept.parent_id && nameById.get(dept.parent_id)"
            class="mt-1 text-xs opacity-60"
          >
            {{ t("systemMyScope.parentDept") }}:
            {{ nameById.get(dept.parent_id) }}
          </div>

          <el-divider class="my-2!" />

          <div class="flex items-center gap-1 text-xs">
            <span class="opacity-60 shrink-0">
              {{ t("systemMyScope.leader") }}
            </span>
            <span class="truncate">
              {{ dept.leader ? userLabel(dept.leader) : "-" }}
            </span>
          </div>
          <div class="flex items-center gap-1 text-xs mt-1">
            <span class="opacity-60 shrink-0">
              {{ t("systemMyScope.managers") }}
            </span>
            <span
              v-if="dept.managers.length"
              class="truncate"
              :title="dept.managers.map(userLabel).join('、')"
            >
              {{ foldUsers(dept.managers) }}
            </span>
            <span v-else>-</span>
          </div>

          <div class="flex-bc mt-3">
            <el-link
              :disabled="!canListUsers"
              :underline="false"
              data-testid="my-scope-members"
              @click="openMembers(dept)"
            >
              {{ t("systemMyScope.members", { count: dept.user_count }) }}
            </el-link>
            <el-button
              link
              type="primary"
              :disabled="!canListUsers"
              :title="t('systemMyScope.viewInUserPage')"
              @click="goDeptUsers(dept.pk)"
            >
              {{ t("systemMyScope.manageMembers") }}
            </el-button>
          </div>
        </el-card>
      </div>
      <div v-if="remainingCount > 0" class="mt-3 text-center">
        <el-button
          link
          type="primary"
          data-testid="my-scope-load-more"
          @click="loadMore"
        >
          {{ t("systemMyScope.loadMore", { count: remainingCount }) }}
        </el-button>
      </div>
    </template>

    <!-- 层级视图：虚拟树（tree-v2），高度按视口实测 -->
    <el-card v-else shadow="never" body-class="pt-2!">
      <!-- 量测锚点包一层 div：组件 ref 拿到的是实例而非元素 -->
      <div ref="pageRef">
        <el-tree-v2
          ref="treeRef"
          :data="treeData"
          :height="panelHeight"
          :item-size="32"
          :expand-on-click-node="false"
          :props="{ value: 'pk', children: 'children', label: 'name' }"
          :default-expanded-keys="allTreeKeys"
          :filter-method="filterNode"
        >
          <template #default="{ data }">
            <div class="flex items-center gap-2 w-full min-w-0 py-0.5">
              <span class="font-medium truncate">{{ data.name }}</span>
              <el-tag
                v-if="data.is_direct"
                size="small"
                type="primary"
                class="shrink-0"
              >
                {{ t("systemMyScope.direct") }}
              </el-tag>
              <span class="text-xs opacity-60 shrink-0">{{ data.code }}</span>
              <span class="ml-auto text-xs opacity-60 shrink-0">
                {{ t("systemMyScope.members", { count: data.user_count }) }}
              </span>
              <el-button
                link
                type="primary"
                size="small"
                :disabled="!canListUsers"
                :icon="useRenderIcon(ViewIcon)"
                :title="t('systemMyScope.viewMembers')"
                :aria-label="t('systemMyScope.viewMembers')"
                @click="openMembers(data)"
              />
              <el-button
                link
                size="small"
                :disabled="!canListUsers"
                :icon="useRenderIcon(UserIcon)"
                :title="t('systemMyScope.viewInUserPage')"
                :aria-label="t('systemMyScope.viewInUserPage')"
                @click="goDeptUsers(data.pk)"
              />
            </div>
          </template>
        </el-tree-v2>
      </div>
    </el-card>

    <MemberDrawer v-model="drawerVisible" :dept="activeDept" />
  </div>
</template>
