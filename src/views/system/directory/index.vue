<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import { listRows } from "@/api/base";
import { directoryApi, type DirectoryMember } from "@/api/system/directory";
import { searchDeptApi, searchPostApi } from "@/api/system/search";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { handleTree } from "@/utils/tree";

defineOptions({
  name: "SystemDirectory"
});

/**
 * 通讯录（只读人员名录）：按部门/按岗位两种视角浏览在用用户。
 *
 * - 成员列表走 /api/system/directory（list:SystemDirectory 权限点，数据权限随调用者）；
 * - 部门树复用 search/dept 候选端点（list:SearchDept），岗位清单复用 search/post
 *   （list:SearchPost）——与通知选人等远程搜索同口径，通讯录自身不叠加管理面权限；
 * - 岗位视角按岗位筛选成员（仅启用岗位在岗用户，与审批人解析口径一致）。
 */
const { t } = useI18n();

type Mode = "dept" | "post";
const mode = ref<Mode>("dept");

/* ---------------- 左栏：部门树 / 岗位清单 ---------------- */

interface TreeNode {
  pk: number | string;
  name: string;
  children?: TreeNode[];
}
const deptTree = ref<TreeNode[]>([]);
const deptLoading = ref(false);

interface PostOption {
  pk: string;
  name: string;
  code: string;
}
const postOptions = ref<PostOption[]>([]);
const postLoading = ref(false);
const selectedDept = ref<number | string | "">("");
const selectedPost = ref<string>("");

onMounted(async () => {
  if (hasAuth("list:SearchDept")) {
    deptLoading.value = true;
    fetchAllRows(searchDeptApi.list)
      .then(res => {
        if (res.code === SUCCESS_CODE && res.data) {
          deptTree.value = handleTree(
            listRows<Record<string, unknown>>(res as never)
          ) as unknown as TreeNode[];
        }
      })
      .catch(() => undefined)
      .finally(() => (deptLoading.value = false));
  }
  if (hasAuth("list:SearchPost")) {
    postLoading.value = true;
    fetchAllRows(searchPostApi.list)
      .then(res => {
        if (res.code === SUCCESS_CODE && res.data) {
          postOptions.value = listRows<PostOption>(res as never);
        }
      })
      .catch(() => undefined)
      .finally(() => (postLoading.value = false));
  }
});

function onDeptClick(node: TreeNode) {
  selectedDept.value = selectedDept.value === node.pk ? "" : node.pk;
  fetchData({ page: 1 });
}

function onPostClick(post: PostOption) {
  selectedPost.value = selectedPost.value === post.code ? "" : post.code;
  fetchData({ page: 1 });
}

/* ---------------- 右栏：成员名录（服务端分页） ---------------- */

const members = ref<DirectoryMember[]>([]);
const loading = ref(false);
const keyword = ref("");
const page = ref(1);
const size = ref(20);
const total = ref(0);

async function fetchData(reset: { page?: number } = {}) {
  if (reset.page) page.value = reset.page;
  loading.value = true;
  try {
    const res = await directoryApi.list({
      page: page.value,
      size: size.value,
      dept: mode.value === "dept" ? selectedDept.value : "",
      posts:
        mode.value === "post" && selectedPost.value ? selectedPost.value : "",
      keyword: keyword.value.trim(),
      ordering: "username"
    });
    if (res.code === SUCCESS_CODE && res.data) {
      const body = res.data as { results?: DirectoryMember[]; total?: number };
      members.value = body.results ?? [];
      total.value = body.total ?? 0;
    }
  } catch {
    // 请求失败保持现状（加载态在 finally 收口）
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);

function onSearch() {
  fetchData({ page: 1 });
}

function formatGender(row: { gender?: { label?: string } | null }): string {
  return row.gender?.label || "-";
}

function formatPostPk(post: { pk: string | number }): string {
  return String(post.pk);
}
</script>

<template>
  <div v-if="hasAuth('list:SystemDirectory')" class="main-content">
    <div class="flex gap-3 directory-page">
      <!-- 左栏：部门树 / 岗位清单 -->
      <div class="directory-aside">
        <el-radio-group
          v-model="mode"
          size="small"
          class="mb-2"
          @change="
            selectedDept = '';
            selectedPost = '';
            fetchData({ page: 1 });
          "
        >
          <el-radio-button value="dept">{{
            t("directory.viewByDept")
          }}</el-radio-button>
          <el-radio-button value="post">{{
            t("directory.viewByPost")
          }}</el-radio-button>
        </el-radio-group>

        <template v-if="mode === 'dept'">
          <el-tree
            v-if="hasAuth('list:SearchDept')"
            v-loading="deptLoading"
            :data="deptTree"
            node-key="pk"
            :props="{ children: 'children', label: 'name' }"
            :expand-on-click-node="false"
            :highlight-current="true"
            :current-node-key="selectedDept ? String(selectedDept) : undefined"
            class="directory-tree"
            @node-click="onDeptClick"
          />
        </template>
        <template v-else>
          <div v-loading="postLoading" class="directory-posts">
            <div
              v-for="post in postOptions"
              :key="post.code"
              :class="[
                'directory-post-item',
                selectedPost === post.code ? 'is-active' : ''
              ]"
              @click="onPostClick(post)"
            >
              <span class="truncate">{{ post.name }}</span>
              <span
                class="ml-auto pl-2 text-xs text-(--el-text-color-secondary)"
              >
                {{ post.code }}
              </span>
            </div>
            <el-empty
              v-if="!postLoading && !postOptions.length"
              :description="t('directory.emptyPosts')"
              :image-size="70"
            />
          </div>
        </template>
      </div>

      <!-- 右栏：成员名录 -->
      <div class="flex-1 min-w-0 directory-main">
        <div class="mb-2 flex gap-2">
          <el-input
            v-model="keyword"
            size="small"
            clearable
            class="max-w-60!"
            :placeholder="t('directory.searchPlaceholder')"
            @keyup.enter="onSearch"
            @clear="onSearch"
          />
          <el-button size="small" type="primary" @click="onSearch">
            {{ t("directory.search") }}
          </el-button>
        </div>

        <el-table
          v-loading="loading"
          :data="members"
          size="small"
          border
          stripe
        >
          <el-table-column :label="t('directory.name')" min-width="150">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <el-avatar :size="26" :src="row.avatar || undefined">
                  {{ (row.nickname || row.username || "?").slice(0, 1) }}
                </el-avatar>
                <span>{{ row.nickname || row.username }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="username"
            :label="t('directory.username')"
            min-width="110"
          />
          <el-table-column :label="t('directory.dept')" min-width="110">
            <template #default="{ row }">
              {{ row.dept?.name || "-" }}
            </template>
          </el-table-column>
          <el-table-column :label="t('directory.posts')" min-width="160">
            <template #default="{ row }">
              <template v-if="row.posts?.length">
                <el-tag
                  v-for="post in row.posts"
                  :key="formatPostPk(post)"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="mr-1"
                >
                  {{ post.name }}
                </el-tag>
              </template>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('directory.gender')" width="70">
            <template #default="{ row }">
              {{ formatGender(row) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="email"
            :label="t('directory.email')"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="phone"
            :label="t('directory.phone')"
            min-width="120"
          />
          <el-table-column
            prop="last_login"
            :label="t('directory.lastLogin')"
            min-width="150"
          >
            <template #default="{ row }">
              {{ row.last_login || "-" }}
            </template>
          </el-table-column>
        </el-table>

        <div class="mt-2 flex justify-end">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="size"
            layout="total, prev, pager, next, sizes"
            :total="total"
            :page-sizes="[10, 20, 50]"
            @current-change="() => fetchData()"
            @size-change="() => fetchData({ page: 1 })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.main-content {
  --main-content-margin: 24px 24px 0;
}

.directory-page {
  min-height: 200px;
}

.directory-aside {
  flex-shrink: 0;
  width: 240px;
  overflow: auto;
}

.directory-tree {
  :deep(.el-tree-node__content) {
    height: 30px;
  }
}

.directory-posts {
  max-height: 60vh;
  overflow: auto;
}

.directory-post-item {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.is-active {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}
</style>
