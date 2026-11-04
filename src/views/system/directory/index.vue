<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { deviceDetection } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { useFullHeightPanel } from "@/hooks/useFullHeightPanel";
import { ReSplitPane } from "@/components/ReSplitPane";
import ReEmpty from "@/components/ReEmpty";
import RePage from "@/components/RePage";
import { useSplitPaneConfig } from "@/hooks/useSplitPaneConfig";
import DirectoryAside from "./components/DirectoryAside.vue";
import DirectoryMembers from "./components/DirectoryMembers.vue";

/**
 * 通讯录（只读人员名录）：按部门/按岗位两种视角浏览在用用户。
 *
 * - 成员列表走 /api/identity/directory（list:SystemDirectory 权限点，数据权限随调用者）；
 * - 部门树复用 search/dept 候选端点（list:SearchDept，带部门人数），岗位清单复用
 *   search/post（list:SearchPost，带成员数）——与通知选人等远程搜索同口径；
 * - 桌面为可拖拽分栏（宽度比例持久化，与用户管理同口径），移动端上下堆叠。
 */
defineOptions({
  name: "SystemDirectory"
});

const mode = ref<"dept" | "post">("dept");
const dept = ref("");
const post = ref("");
const isMobile = deviceDetection();
const { t } = useI18n();

// 左栏宽度持久化（默认 20%；双击分隔条或点悬浮按钮重置）
const { percent, handleDragEnd } = useSplitPaneConfig("system/directory", {
  defaultPercent: 20,
  minPercent: 10
});

/**
 * 桌面双栏高度：按视口实测（顶栏/页签/页脚/紧凑模式/用户模拟横幅等偏好组合
 * 全部自适应），替代两栏各自 calc(100vh - 141px) 魔数——旧值按默认 chrome 校准，
 * 「隐藏页签」偏好下留出一条空白、默认页脚下还会把页脚顶出视口 ~10px 产生
 * 整页滚动条。聊天室 / AI 控制台同一布局口径（hooks/useFullHeightPanel）。
 */
const { pageRef, panelHeight } = useFullHeightPanel();
</script>

<template>
  <RePage>
    <template v-if="hasAuth('list:SystemDirectory')">
      <!-- pageRef 锚定实测起点：双栏高度 = 视口 − 实测顶距 − 页脚（见 useFullHeightPanel） -->
      <div v-if="!isMobile" ref="pageRef">
        <ReSplitPane
          v-model:percent="percent"
          :split-set="{ minPercent: 10, defaultPercent: 20, split: 'vertical' }"
          @drag-end="handleDragEnd"
        >
          <template #paneL>
            <DirectoryAside
              v-model:mode="mode"
              v-model:dept="dept"
              v-model:post="post"
              :style="{ height: `${panelHeight}px` }"
            />
          </template>
          <template #paneR>
            <DirectoryMembers
              :mode="mode"
              :dept="dept"
              :post="post"
              :style="{ height: `${panelHeight}px` }"
            />
          </template>
        </ReSplitPane>
      </div>
      <!-- 移动端：上下堆叠（左栏限高，成员名录紧随其后；compact 分支高度自适应） -->
      <div v-else class="flex flex-col gap-2">
        <DirectoryAside
          v-model:mode="mode"
          v-model:dept="dept"
          v-model:post="post"
          compact
        />
        <DirectoryMembers :mode="mode" :dept="dept" :post="post" compact />
      </div>
    </template>
    <ReEmpty
      v-else
      :description="t('directory.noPermission')"
      :hint="t('directory.noPermissionHint')"
      icon="ep/lock"
    />
  </RePage>
</template>
