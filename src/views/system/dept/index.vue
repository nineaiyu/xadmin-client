<script lang="ts" setup>
import { ref } from "vue";
import { useDept } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import More from "@iconify-icons/ep/more-filled";
import Delete from "@iconify-icons/ep/delete";
import Role from "@iconify-icons/ri/admin-line";
import EditPen from "@iconify-icons/ep/edit-pen";

import Refresh from "@iconify-icons/ep/refresh";
import AddFill from "@iconify-icons/ri/add-circle-line";
import { hasAuth } from "@/router/utils";
import { getIndexType } from "@/utils";

defineOptions({
  name: "SystemDept"
});

const formRef = ref();
const tableRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  buttonClass,
  sortOptions,
  choicesDict,
  manySelectCount,
  onSearch,
  resetForm,
  openDialog,
  handleRole,
  handleDelete,
  handleManyDelete,
  onSelectionCancel,
  handleSelectionChange
} = useDept(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:systemDept')" class="main">
    <div class="float-left w-[99%]">
      <el-form
        ref="formRef"
        :inline="true"
        :model="form"
        class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px] overflow-auto"
      >
        <el-form-item :label="t('labels.id')" prop="pk">
          <el-input
            v-model="form.pk"
            :placeholder="t('labels.id')"
            class="!w-[160px]"
            clearable
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('dept.name')" prop="name">
          <el-input
            v-model="form.name"
            :placeholder="t('dept.name')"
            class="!w-[160px]"
            clearable
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('dept.code')" prop="code">
          <el-input
            v-model="form.code"
            :placeholder="t('dept.code')"
            class="!w-[160px]"
            clearable
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('labels.description')" prop="description">
          <el-input
            v-model="form.description"
            :placeholder="t('labels.description')"
            class="!w-[160px]"
            clearable
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('dept.autoBind')" prop="auto_bind">
          <el-select
            v-model="form.auto_bind"
            class="!w-[180px]"
            clearable
            @change="onSearch"
          >
            <el-option :label="t('labels.enable')" value="1" />
            <el-option :label="t('labels.disable')" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-select
            v-model="form.is_active"
            :placeholder="t('labels.status')"
            class="!w-[160px]"
            clearable
            @change="onSearch"
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
              v-for="item in choicesDict"
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
            @change="onSearch"
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
            @click="onSearch"
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
        :title="t('menus.hsDept')"
        @refresh="onSearch"
      >
        <template #buttons>
          <el-space wrap>
            <div v-if="manySelectCount > 0" v-motion-fade class="w-[360px]">
              <span
                class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
                style="font-size: var(--el-font-size-base)"
              >
                {{ t("buttons.hsselected", { count: manySelectCount }) }}
              </span>
              <el-button text type="primary" @click="onSelectionCancel">
                {{ t("buttons.hscancel") }}
              </el-button>
              <el-popconfirm
                v-if="hasAuth('manyDelete:systemDept')"
                :title="
                  t('buttons.hsbatchdeleteconfirm', { count: manySelectCount })
                "
                @confirm="handleManyDelete"
              >
                <template #reference>
                  <el-button :icon="useRenderIcon(Delete)" plain type="danger">
                    {{ t("buttons.hsbatchdelete") }}
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
            <el-button
              v-if="hasAuth('create:systemDept')"
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
            :adaptiveConfig="{ offsetBottom: 45 }"
            :columns="dynamicColumns"
            :data="dataList"
            :header-cell-style="{
              background: 'var(--el-table-row-hover-bg-color)',
              color: 'var(--el-text-color-primary)'
            }"
            :loading="loading"
            :size="size"
            adaptive
            align-whole="center"
            default-expand-all
            row-key="pk"
            showOverflowTooltip
            table-layout="auto"
            @selection-change="handleSelectionChange"
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
                v-if="hasAuth('update:systemDept')"
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
                v-if="hasAuth('delete:systemDept')"
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
                    <el-dropdown-item v-if="hasAuth('empower:systemDeptRole')">
                      <el-button
                        :class="buttonClass"
                        :icon="useRenderIcon(Role)"
                        :size="size"
                        link
                        type="primary"
                        @click="handleRole(row)"
                      >
                        {{ t("dept.assignRoles") }}
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
:deep(.el-table__inner-wrapper::before) {
  height: 0;
}

.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
