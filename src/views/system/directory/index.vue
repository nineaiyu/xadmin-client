<script lang="ts" setup>
import { ref } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { ReSplitPane } from "@/components/ReSplitPane";
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

// 左栏宽度持久化（默认 20%；双击分隔条或点悬浮按钮重置）
const { percent, handleDragEnd } = useSplitPaneConfig("system/directory", {
  defaultPercent: 20,
  minPercent: 10
});
</script>

<template>
  <div v-if="hasAuth('list:SystemDirectory')" class="main-content">
    <ReSplitPane
      v-if="!isMobile"
      v-model:percent="percent"
      :split-set="{ minPercent: 10, defaultPercent: 20, split: 'vertical' }"
      @drag-end="handleDragEnd"
    >
      <template #paneL>
        <DirectoryAside
          v-model:mode="mode"
          v-model:dept="dept"
          v-model:post="post"
        />
      </template>
      <template #paneR>
        <DirectoryMembers :mode="mode" :dept="dept" :post="post" />
      </template>
    </ReSplitPane>
    <!-- 移动端：上下堆叠（左栏限高，成员名录紧随其后） -->
    <div v-else class="flex flex-col gap-2">
      <DirectoryAside
        v-model:mode="mode"
        v-model:dept="dept"
        v-model:post="post"
        compact
      />
      <DirectoryMembers :mode="mode" :dept="dept" :post="post" compact />
    </div>
  </div>
</template>
