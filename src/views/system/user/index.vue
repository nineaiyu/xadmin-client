<script lang="ts" setup>
import tree from "./tree.vue";
import { computed, ref } from "vue";
import { useUser } from "./utils/hook";
import { getIndexType } from "@/utils";
import { hasGlobalAuth } from "@/router/utils";
import ReBaseTable from "@/components/ReBaseTable";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Role from "@iconify-icons/ri/admin-line";
import More from "@iconify-icons/ep/more-filled";
import Avatar from "@iconify-icons/ri/user-3-fill";
import Message from "@iconify-icons/ri/message-fill";
import Password from "@iconify-icons/ri/lock-password-line";

defineOptions({
  name: "SystemUser"
});

const tableRef = ref();
const treeRef = ref();

const treePk = computed(() => {
  return tableRef.value?.searchFields?.dept;
});

const {
  t,
  api,
  auth,
  columns,
  treeData,
  editForm,
  buttonClass,
  treeLoading,
  selectedNum,
  goNotice,
  handleRole,
  handleReset,
  onTreeSelect,
  handleUpload,
  selectionChange,
  deviceDetection
} = useUser(tableRef);
</script>

<template>
  <div
    v-if="auth.list"
    :class="['flex', 'justify-between', deviceDetection() && 'flex-wrap']"
  >
    <tree
      ref="treeRef"
      :class="['mr-2', deviceDetection() ? 'w-full' : 'min-w-[250px]']"
      :pk="treePk"
      :treeData="treeData"
      :treeLoading="treeLoading"
      @tree-select="onTreeSelect"
    />
    <ReBaseTable
      ref="tableRef"
      :api="api"
      :auth="auth"
      :class="[deviceDetection() ? ['w-full', 'mt-2'] : 'w-[calc(100%-250px)]']"
      :edit-form="editForm"
      :table-columns="columns"
      locale-name="systemUser"
      @plusReset="treeRef.onTreeReset()"
      @selection-change="selectionChange"
    >
      <template #barButtons>
        <el-button
          v-if="hasGlobalAuth('create:systemNotice') && selectedNum"
          :icon="useRenderIcon(Message)"
          plain
          type="primary"
          @click="goNotice()"
        >
          {{ t("systemUser.batchSendNotice") }}
        </el-button>
      </template>
      <template #roles="{ row }">
        <el-space>
          <el-text
            v-for="(role, index) in row.roles_info"
            :key="role.pk"
            :type="getIndexType(index + 1)"
          >
            {{ role.name }}
          </el-text>
        </el-space>
      </template>
      <template #rules="{ row }">
        <el-space>
          <el-text
            v-for="(role, index) in row.rules_info"
            :key="role.pk"
            :type="getIndexType(index + 1)"
          >
            {{ role.name }}
          </el-text>
        </el-space>
      </template>
      <template #extOperation="{ row, size }">
        <el-dropdown>
          <el-button
            :icon="useRenderIcon(More)"
            :size="size"
            class="ml-3 mt-[2px]"
            link
            type="primary"
          />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="auth.upload">
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(Avatar)"
                  :size="size"
                  link
                  type="primary"
                  @click="handleUpload(row)"
                >
                  {{ t("systemUser.editAvatar") }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item v-if="auth.reset">
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(Password)"
                  :size="size"
                  link
                  type="primary"
                  @click="handleReset(row)"
                >
                  {{ t("systemUser.resetPassword") }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item v-if="auth.empower">
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(Role)"
                  :size="size"
                  link
                  type="primary"
                  @click="handleRole(row)"
                >
                  {{ t("systemUser.assignRoles") }}
                </el-button>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </ReBaseTable>
  </div>
</template>
