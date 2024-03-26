<script lang="ts" setup>
import { ref } from "vue";
import { useUser } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import tree from "./tree.vue";
import Password from "@iconify-icons/ri/lock-password-line";
import Avatar from "@iconify-icons/ri/user-3-fill";
import More from "@iconify-icons/ep/more-filled";
import Delete from "@iconify-icons/ep/delete";
import Role from "@iconify-icons/ri/admin-line";
import EditPen from "@iconify-icons/ep/edit-pen";

import Refresh from "@iconify-icons/ep/refresh";
import AddFill from "@iconify-icons/ri/add-circle-line";
import Download from "@iconify-icons/ri/download-line";
import Message from "@iconify-icons/ri/message-fill";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { getIndexType } from "@/utils";

defineOptions({
  name: "SystemUser"
});

const formRef = ref();
const tableRef = ref();
const treeRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  treeData,
  pagination,
  buttonClass,
  sortOptions,
  treeLoading,
  modeChoicesDict,
  selectedNum,
  deviceDetection,
  onSearch,
  exportExcel,
  resetForm,
  openDialog,
  goNotice,
  handleRole,
  handleReset,
  onTreeSelect,
  handleUpload,
  handleDelete,
  handleManyDelete,
  onSelectionCancel,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = useUser(tableRef, treeRef);
</script>

<template>
  <div
    v-if="hasAuth('list:systemUser')"
    :class="['flex', 'justify-between', deviceDetection() && 'flex-wrap']"
  >
    <tree
      ref="treeRef"
      :pk="form.dept?.toString()"
      :treeData="treeData"
      :treeLoading="treeLoading"
      :class="['mr-2', deviceDetection() ? 'w-full' : 'min-w-[250px]']"
      @tree-select="onTreeSelect"
    />
    <div
      :class="[deviceDetection() ? ['w-full', 'mt-2'] : 'w-[calc(100%-250px)]']"
    >
      <el-form
        ref="formRef"
        :inline="true"
        :model="form"
        class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px] overflow-auto"
      >
        <el-form-item :label="t('labels.id')" prop="pk">
          <el-input
            v-model="form.pk"
            :placeholder="t('user.verifyUserId')"
            class="!w-[160px]"
            clearable
            @keyup.enter="onSearch(true)"
          />
        </el-form-item>
        <el-form-item :label="t('user.username')" prop="username">
          <el-input
            v-model="form.username"
            :placeholder="t('user.verifyUsername')"
            class="!w-[160px]"
            clearable
            @keyup.enter="onSearch(true)"
          />
        </el-form-item>
        <el-form-item :label="t('user.mobile')" prop="mobile">
          <el-input
            v-model="form.mobile"
            :placeholder="t('user.verifyMobile')"
            class="!w-[160px]"
            clearable
            @keyup.enter="onSearch(true)"
          />
        </el-form-item>
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-select
            v-model="form.is_active"
            :placeholder="t('labels.status')"
            class="!w-[160px]"
            clearable
            @change="onSearch(true)"
          >
            <el-option :label="t('labels.active')" value="1" />
            <el-option :label="t('labels.inactive')" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('permission.mode')" prop="mode">
          <el-select
            v-model="form.mode_type"
            class="!w-[180px]"
            clearable
            @change="onSearch"
          >
            <el-option
              v-for="item in modeChoicesDict"
              :key="item.key"
              :disabled="item.disabled"
              :label="item.label"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('labels.sort')">
          <el-select
            v-model="form.ordering"
            class="!w-[180px]"
            clearable
            @change="onSearch(true)"
          >
            <el-option
              v-for="item in sortOptions"
              :key="item.key"
              :label="item.label"
              :value="item.key"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button
            :icon="useRenderIcon('ri:search-line')"
            :loading="loading"
            type="primary"
            @click="onSearch(true)"
          >
            {{ t("buttons.hssearch") }}
          </el-button>
          <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
            {{ t("buttons.hsreload") }}
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar
        :columns="columns"
        :title="t('menus.hsUser')"
        @refresh="onSearch(true)"
      >
        <template #title>
          <el-space>
            <p class="font-bold truncate">{{ t("menus.hsUser") }}</p>
            <div
              v-if="selectedNum > 0"
              v-motion-fade
              class="bg-[var(--el-fill-color-light)] w-full h-[46px] m-2 pl-4 flex items-center rounded-md"
            >
              <span
                class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
                style="font-size: var(--el-font-size-base)"
              >
                {{ t("buttons.hsselected", { count: selectedNum }) }}
              </span>
              <el-button text type="primary" @click="onSelectionCancel">
                {{ t("buttons.hscancel") }}
              </el-button>
            </div>
          </el-space>
        </template>
        <template #buttons>
          <el-space wrap>
            <div v-if="selectedNum > 0" v-motion-fade>
              <el-popconfirm
                v-if="hasAuth('manyDelete:systemUser')"
                :title="
                  t('buttons.hsbatchdeleteconfirm', { count: selectedNum })
                "
                @confirm="handleManyDelete"
              >
                <template #reference>
                  <el-button :icon="useRenderIcon(Delete)" plain type="danger">
                    {{ t("buttons.hsbatchdelete") }}
                  </el-button>
                </template>
              </el-popconfirm>
              <el-button
                v-if="hasGlobalAuth('create:systemNotice')"
                :icon="useRenderIcon(Message)"
                plain
                type="primary"
                @click="goNotice()"
              >
                {{ t("user.batchSendNotice") }}
              </el-button>
            </div>
            <el-button
              v-if="false"
              v-optimize="{
                event: 'click',
                fn: exportExcel,
                immediate: true,
                timeout: 5000
              }"
              :icon="useRenderIcon(Download)"
              type="primary"
            >
              {{ t("user.exportExcel") }}
            </el-button>
            <el-button
              v-if="hasAuth('create:systemUser')"
              :icon="useRenderIcon(AddFill)"
              type="primary"
              @click="openDialog()"
            >
              {{ t("buttons.hsadd") }}
            </el-button>
          </el-space>
        </template>
        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            ref="tableRef"
            :adaptiveConfig="{ offsetBottom: 108 }"
            :columns="dynamicColumns"
            :data="dataList"
            :header-cell-style="{
              background: 'var(--el-table-row-hover-bg-color)',
              color: 'var(--el-text-color-primary)'
            }"
            :loading="loading"
            :pagination="pagination"
            :paginationSmall="size === 'small'"
            :size="size"
            adaptive
            align-whole="center"
            row-key="pk"
            table-layout="auto"
            @selection-change="handleSelectionChange"
            @page-size-change="handleSizeChange"
            @page-current-change="handleCurrentChange"
          >
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
            <template #operation="{ row }">
              <el-button
                v-if="hasAuth('update:systemUser')"
                :icon="useRenderIcon(EditPen)"
                :size="size"
                class="reset-margin"
                link
                type="primary"
                @click="openDialog(false, row)"
              >
                {{ t("buttons.hsedit") }}
              </el-button>
              <el-popconfirm
                v-if="hasAuth('delete:systemUser')"
                :title="t('buttons.hsconfirmdelete')"
                @confirm="handleDelete(row)"
              >
                <template #reference>
                  <el-button
                    :icon="useRenderIcon(Delete)"
                    :size="size"
                    class="reset-margin"
                    link
                    type="danger"
                  >
                    {{ t("buttons.hsdelete") }}
                  </el-button>
                </template>
              </el-popconfirm>

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
                    <el-dropdown-item v-if="hasAuth('upload:systemAvatar')">
                      <el-button
                        :class="buttonClass"
                        :icon="useRenderIcon(Avatar)"
                        :size="size"
                        link
                        type="primary"
                        @click="handleUpload(row)"
                      >
                        {{ t("user.editAvatar") }}
                      </el-button>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="hasAuth('update:systemUserPwd')">
                      <el-button
                        :class="buttonClass"
                        :icon="useRenderIcon(Password)"
                        :size="size"
                        link
                        type="primary"
                        @click="handleReset(row)"
                      >
                        {{ t("user.resetPassword") }}
                      </el-button>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="hasAuth('empower:systemUserRole')">
                      <el-button
                        :class="buttonClass"
                        :icon="useRenderIcon(Role)"
                        :size="size"
                        link
                        type="primary"
                        @click="handleRole(row)"
                      >
                        {{ t("user.assignRoles") }}
                      </el-button>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-dropdown-menu__item i) {
  margin: 0;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

.main-content {
  margin: 24px 24px 0 !important;
}
</style>
