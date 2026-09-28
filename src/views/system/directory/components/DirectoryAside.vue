<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import { listRows } from "@/api/base";
import type {
  DirectoryDeptNode,
  DirectoryPostOption
} from "@/api/system/directory";
import { searchDeptApi, searchPostApi } from "@/api/system/search";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { handleTree } from "@/utils/tree";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Search from "~icons/ri/search-line";
import Refresh from "~icons/ep/refresh";

/**
 * 通讯录左栏：按部门 / 按岗位两种浏览维度。
 *
 * - 部门树来自 search/dept 候选端点（带部门人数），选中即筛选成员（含下级部门）；
 * - 岗位清单来自 search/post（仅启用岗位，带成员数），选中即筛选持岗成员；
 * - 两种维度互斥：切换维度清空已选值；再次点击已选项取消选择（回到全部）。
 */
defineOptions({ name: "DirectoryAside" });

defineProps<{
  /** 移动端堆叠形态：自适应高度并限高（桌面由分栏容器给出高度） */
  compact?: boolean;
}>();

const mode = defineModel<"dept" | "post">("mode", { required: true });
const dept = defineModel<string>("dept", { required: true });
const post = defineModel<string>("post", { required: true });

const { t } = useI18n();

const canUseDept = hasAuth("list:SearchDept");
const canUsePost = hasAuth("list:SearchPost");

const deptTree = ref<DirectoryDeptNode[]>([]);
const deptLoading = ref(false);
const postOptions = ref<DirectoryPostOption[]>([]);
const postLoading = ref(false);
const filterText = ref("");
const treeRef = ref();

const treeProps = { children: "children", label: "name" };

const filterPlaceholder = computed(() =>
  mode.value === "dept" ? t("directory.searchDept") : t("directory.searchPost")
);

const filteredPosts = computed(() => {
  const keyword = filterText.value.trim().toLowerCase();
  if (!keyword) return postOptions.value;
  return postOptions.value.filter(
    item =>
      item.name.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword)
  );
});

function loadDeptTree() {
  if (!canUseDept) return;
  deptLoading.value = true;
  fetchAllRows(searchDeptApi.list)
    .then(res => {
      if (res.code === SUCCESS_CODE && res.data) {
        deptTree.value = handleTree(
          listRows<Record<string, unknown>>(res as never)
        ) as unknown as DirectoryDeptNode[];
      }
    })
    .catch(() => undefined)
    .finally(() => (deptLoading.value = false));
}

function loadPosts() {
  if (!canUsePost) return;
  postLoading.value = true;
  fetchAllRows(searchPostApi.list)
    .then(res => {
      if (res.code === SUCCESS_CODE && res.data) {
        postOptions.value = listRows<DirectoryPostOption>(res as never);
      }
    })
    .catch(() => undefined)
    .finally(() => (postLoading.value = false));
}

function reload() {
  loadDeptTree();
  loadPosts();
}

onMounted(() => {
  reload();
  // 仅一种维度可用时直接落到可用维度（避免空壳视角）
  if (!canUseDept && canUsePost) mode.value = "post";
  if (canUseDept && !canUsePost) mode.value = "dept";
});

watch(filterText, value => {
  treeRef.value?.filter(value);
});

function clearDept() {
  dept.value = "";
}

function clearPost() {
  post.value = "";
}

function onDeptClick(node: DirectoryDeptNode) {
  dept.value = dept.value === String(node.pk) ? "" : String(node.pk);
}

function onPostClick(item: DirectoryPostOption) {
  post.value = post.value === String(item.pk) ? "" : String(item.pk);
}

/** 节点/条目过滤：部门按名称，岗位按名称或编码 */
function filterNode(value: string, data: Record<string, unknown>) {
  if (!value) return true;
  return String(data.name ?? "").includes(value);
}

function postTitle(item: DirectoryPostOption) {
  const parts = [`${item.name}(${item.code})`];
  if (item.dept_name) parts.push(item.dept_name);
  return parts.join(" · ");
}
</script>

<template>
  <div
    class="directory-aside bg-bg_color flex flex-col overflow-hidden"
    :class="
      compact
        ? 'max-h-90 rounded-lg border border-(--el-border-color-lighter)'
        : 'directory-desktop'
    "
  >
    <!-- 浏览维度切换 -->
    <div class="px-2 pt-2">
      <el-radio-group v-model="mode" size="small" class="directory-mode w-full">
        <el-radio-button value="dept" class="flex-1">
          {{ t("directory.viewByDept") }}
        </el-radio-button>
        <el-radio-button value="post" class="flex-1">
          {{ t("directory.viewByPost") }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 过滤与刷新 -->
    <div class="flex items-center gap-1 p-2">
      <el-input
        v-model="filterText"
        size="small"
        clearable
        :placeholder="filterPlaceholder"
      >
        <template #prefix>
          <el-icon><component :is="useRenderIcon(Search)" /></el-icon>
        </template>
      </el-input>
      <el-button
        v-loading="deptLoading || postLoading"
        size="small"
        text
        :icon="useRenderIcon(Refresh)"
        :aria-label="t('directory.refresh')"
        :title="t('directory.refresh')"
        @click="reload"
      />
    </div>

    <el-divider class="m-0!" />

    <el-scrollbar class="min-h-0 flex-1">
      <div class="p-2" :class="compact ? 'max-h-60' : ''">
        <!-- 部门视角 -->
        <template v-if="mode === 'dept'">
          <button
            type="button"
            class="directory-item"
            :class="{ 'is-active': !dept }"
            @click="clearDept"
          >
            <span class="truncate">{{ t("directory.allMembers") }}</span>
          </button>
          <el-tree
            v-if="canUseDept"
            ref="treeRef"
            v-loading="deptLoading"
            :data="deptTree"
            node-key="pk"
            :props="treeProps"
            :filter-node-method="filterNode"
            :expand-on-click-node="false"
            :highlight-current="true"
            :current-node-key="dept || undefined"
            default-expand-all
            class="directory-tree"
            @node-click="onDeptClick"
          >
            <template #default="{ node, data }">
              <span class="flex-bc min-w-0 flex-1 gap-2">
                <span class="truncate">{{ node.label }}</span>
                <span v-if="data.user_count" class="directory-count">
                  {{ data.user_count }}
                </span>
              </span>
            </template>
          </el-tree>
          <el-empty
            v-else
            :description="t('directory.emptyDept')"
            :image-size="60"
          />
        </template>

        <!-- 岗位视角 -->
        <template v-else>
          <button
            type="button"
            class="directory-item"
            :class="{ 'is-active': !post }"
            @click="clearPost"
          >
            <span class="truncate">{{ t("directory.allPosts") }}</span>
          </button>
          <button
            v-for="item in filteredPosts"
            :key="item.pk"
            type="button"
            class="directory-item"
            :class="{ 'is-active': post === String(item.pk) }"
            :title="postTitle(item)"
            :data-post-pk="item.pk"
            @click="onPostClick(item)"
          >
            <span class="truncate">{{ item.name }}</span>
            <span v-if="item.user_count" class="directory-count">
              {{ item.user_count }}
            </span>
          </button>
          <el-empty
            v-if="!postLoading && !filteredPosts.length"
            :description="t('directory.emptyPosts')"
            :image-size="60"
          />
        </template>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.directory-desktop {
  height: calc(100vh - 141px);
}

.directory-mode {
  :deep(.el-radio-button) {
    flex: 1;
  }

  :deep(.el-radio-button__inner) {
    width: 100%;
  }
}

.directory-item {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 13px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;

  &:hover {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }

  &.is-active {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.directory-tree {
  :deep(.el-tree-node__content) {
    height: 30px;
  }
}

.directory-count {
  flex-shrink: 0;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 16px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}
</style>
