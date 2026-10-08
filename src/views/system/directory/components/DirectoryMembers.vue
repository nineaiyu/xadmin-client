<script lang="ts" setup>
import { h, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { deviceDetection } from "@pureadmin/utils";
import { SUCCESS_CODE } from "@/api/types";
import { directoryApi, type DirectoryMember } from "@/api/system/directory";
import { message } from "@/utils/message";
import { addDrawer } from "@/components/ReDrawer";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Search from "~icons/ri/search-line";
import CardView from "~icons/ri/layout-grid-line";
import ListView from "~icons/ri/list-unordered";
import MemberDetail from "./MemberDetail.vue";

/**
 * 通讯录右栏：成员名录（服务端分页）。
 *
 * - 数据源 /api/system/directory（list:SystemDirectory；数据权限随调用者收口）；
 * - 卡片（默认，认人场景）/ 列表（找联系方式场景）两种视图共用同一份数据与分页；
 * - 点击成员打开只读详情抽屉（ReDrawer，无编辑动作）。
 */
defineOptions({ name: "DirectoryMembers" });

const props = defineProps<{
  mode: "dept" | "post";
  dept: string;
  post: string;
  /** 移动端堆叠形态：高度自适应（桌面由分栏容器给出高度） */
  compact?: boolean;
}>();

const { t } = useI18n();

const keyword = ref("");
const members = ref<DirectoryMember[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const loading = ref(false);
const viewMode = ref<"card" | "list">("card");

async function fetchData(resetPage = false) {
  if (resetPage) page.value = 1;
  loading.value = true;
  try {
    const res = await directoryApi.list({
      page: page.value,
      size: size.value,
      dept: props.mode === "dept" ? props.dept : "",
      posts: props.mode === "post" && props.post ? props.post : "",
      keyword: keyword.value.trim(),
      ordering: "username"
    });
    if (res.code === SUCCESS_CODE && res.data) {
      const body = res.data as { results?: DirectoryMember[]; total?: number };
      members.value = body.results ?? [];
      total.value = body.total ?? 0;
    } else {
      message(String(res.detail || t("directory.membersLoadFailed")), {
        type: "warning"
      });
    }
  } catch (error) {
    // 失败点名（此前静默吞错：用户只见空列表，无从判断是无人还是加载失败）
    message(
      (error as { detail?: string })?.detail ||
        t("directory.membersLoadFailed"),
      { type: "warning" }
    );
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchData());

// 左栏维度/取值变化即刷新（含切换浏览维度）
watch(
  () => [props.mode, props.dept, props.post],
  () => fetchData(true)
);

function onSearch() {
  fetchData(true);
}

function initialOf(row: DirectoryMember): string {
  return (row.nickname || row.username || "?").slice(0, 1).toUpperCase();
}

/** 卡片资料区是否有可展示项（部门/邮箱/手机全空时收敛为一行提示） */
function hasProfile(row: DirectoryMember): boolean {
  return Boolean(row.dept?.name || row.email || row.phone);
}

/** 岗位全名（列表视图标签截断时以 title 兜底展示全部） */
function postNames(row: DirectoryMember): string {
  return (row.posts || []).map(item => item.name).join("、");
}

function openDetail(row: DirectoryMember) {
  addDrawer({
    title: t("directory.memberDetail"),
    size: deviceDetection() ? "100%" : "420px",
    destroyOnClose: true,
    hideFooter: true,
    contentRenderer: () => h(MemberDetail, { row })
  });
}
</script>

<template>
  <div
    class="directory-members bg-bg_color flex flex-col overflow-hidden"
    :class="
      compact
        ? 'max-h-150 rounded-lg border border-(--el-border-color-lighter)'
        : 'directory-desktop'
    "
  >
    <!-- 工具条：关键字搜索 + 总数 + 视图切换 -->
    <div class="flex flex-wrap items-center gap-2 p-3 pb-2">
      <el-input
        v-model="keyword"
        class="max-w-72"
        clearable
        :placeholder="t('directory.searchPlaceholder')"
        @keyup.enter="onSearch"
        @clear="onSearch"
      >
        <template #prefix>
          <el-icon><component :is="useRenderIcon(Search)" /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" @click="onSearch">
        {{ t("directory.search") }}
      </el-button>
      <div class="ml-auto flex items-center gap-3">
        <span class="text-sm text-(--el-text-color-secondary)">
          {{ t("directory.total", { n: total }) }}
        </span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button
            value="card"
            :aria-label="t('directory.viewCard')"
            :title="t('directory.viewCard')"
          >
            <el-icon><component :is="useRenderIcon(CardView)" /></el-icon>
          </el-radio-button>
          <el-radio-button
            value="list"
            :aria-label="t('directory.viewList')"
            :title="t('directory.viewList')"
          >
            <el-icon><component :is="useRenderIcon(ListView)" /></el-icon>
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <el-divider class="m-0!" />

    <!-- 成员名录 -->
    <el-scrollbar class="min-h-0 flex-1">
      <div v-loading="loading" class="p-3">
        <!-- 卡片视图：认人场景（大头像 + 岗位 + 联系方式） -->
        <div
          v-if="viewMode === 'card' && members.length"
          class="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3"
        >
          <button
            v-for="row in members"
            :key="row.pk"
            type="button"
            class="member-card"
            :data-member-pk="row.pk"
            @click="openDetail(row)"
          >
            <el-avatar :size="44" :src="row.avatar || undefined">
              {{ initialOf(row) }}
            </el-avatar>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-1.5">
                <span class="truncate text-sm font-medium">
                  {{ row.nickname || row.username }}
                </span>
                <span
                  v-if="row.nickname"
                  class="truncate text-xs text-(--el-text-color-secondary)"
                >
                  {{ row.username }}
                </span>
              </div>
              <div class="mt-1 flex min-h-5 flex-wrap items-center gap-1">
                <el-tag
                  v-for="item in row.posts?.slice(0, 2)"
                  :key="item.pk"
                  size="small"
                  effect="plain"
                >
                  {{ item.name }}
                </el-tag>
                <span
                  v-if="!row.posts?.length"
                  class="text-xs text-(--el-text-color-secondary)"
                >
                  {{ t("directory.noPost") }}
                </span>
              </div>
              <div
                class="mt-1.5 space-y-0.5 text-xs text-(--el-text-color-secondary)"
              >
                <template v-if="hasProfile(row)">
                  <div
                    v-if="row.dept?.name"
                    class="truncate"
                    :title="row.dept.name"
                  >
                    {{ t("directory.dept") }}: {{ row.dept.name }}
                  </div>
                  <div v-if="row.email" class="truncate" :title="row.email">
                    {{ row.email }}
                  </div>
                  <div v-if="row.phone" class="truncate" :title="row.phone">
                    {{ row.phone }}
                  </div>
                </template>
                <div v-else>{{ t("directory.noContact") }}</div>
              </div>
            </div>
          </button>
        </div>

        <!-- 列表视图：找联系方式场景（紧凑行） -->
        <div v-else-if="members.length" class="member-list">
          <div class="member-head">
            <span>{{ t("directory.name") }}</span>
            <span class="hidden lg:block">{{ t("directory.dept") }}</span>
            <span class="hidden lg:block">{{ t("directory.posts") }}</span>
            <span class="hidden lg:block">{{ t("directory.email") }}</span>
            <span class="hidden lg:block">{{ t("directory.phone") }}</span>
            <span class="hidden lg:block">{{ t("directory.lastLogin") }}</span>
          </div>
          <button
            v-for="row in members"
            :key="row.pk"
            type="button"
            class="member-row"
            :data-member-pk="row.pk"
            @click="openDetail(row)"
          >
            <span class="flex min-w-0 items-center gap-2">
              <el-avatar :size="28" :src="row.avatar || undefined">
                {{ initialOf(row) }}
              </el-avatar>
              <span class="min-w-0">
                <span class="block truncate text-sm">
                  {{ row.nickname || row.username }}
                </span>
                <span
                  class="block truncate text-xs text-(--el-text-color-secondary)"
                >
                  {{ row.username }}
                </span>
              </span>
            </span>
            <span class="hidden min-w-0 truncate lg:block">
              {{ row.dept?.name || "-" }}
            </span>
            <span class="hidden min-w-0 items-center gap-1 lg:flex">
              <el-tag
                v-if="row.posts?.length"
                size="small"
                effect="plain"
                class="min-w-0"
                :title="postNames(row)"
              >
                {{ row.posts[0].name }}
              </el-tag>
              <el-tag
                v-if="(row.posts?.length || 0) > 1"
                size="small"
                type="info"
                effect="plain"
                class="shrink-0"
              >
                +{{ (row.posts?.length || 0) - 1 }}
              </el-tag>
              <span v-if="!row.posts?.length">-</span>
            </span>
            <span
              class="hidden truncate text-(--el-text-color-regular) lg:block"
            >
              {{ row.email || "-" }}
            </span>
            <span
              class="hidden truncate text-(--el-text-color-regular) lg:block"
            >
              {{ row.phone || "-" }}
            </span>
            <span
              class="hidden truncate text-xs text-(--el-text-color-secondary) lg:block"
            >
              {{ row.last_login || "-" }}
            </span>
          </button>
        </div>

        <el-empty
          v-if="!loading && !members.length"
          :description="t('directory.empty')"
        />
      </div>
    </el-scrollbar>

    <!-- 分页 -->
    <div
      class="flex justify-end border-t border-(--el-border-color-lighter) p-2"
    >
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :layout="
          deviceDetection()
            ? 'prev, pager, next'
            : 'prev, pager, next, sizes, jumper'
        "
        :total="total"
        :page-sizes="[10, 20, 50]"
        @current-change="() => fetchData()"
        @size-change="() => fetchData(true)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.directory-desktop {
  height: calc(100vh - 141px);
}

.member-card {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 12px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--el-box-shadow-lighter);
  }
}

// 岗位标签宽约束：flex 单元格内标签不收缩且不裁剪时长岗位名会溢出到相邻列，
// 统一限制在单元格宽度内并按省略号截断（全名由 title 兜底）
.member-card,
.member-row {
  :deep(.el-tag) {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  :deep(.el-tag__content) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.member-list {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.member-head,
.member-row {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 8px;
  align-items: center;

  @media (width >= 1024px) {
    grid-template-columns:
      minmax(150px, 1.3fr) minmax(0, 0.9fr) minmax(0, 1fr)
      minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1fr);
  }
}

.member-head {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.member-row {
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--el-fill-color-light);
  }
}
</style>
