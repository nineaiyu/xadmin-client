<script setup lang="ts">
import { ref } from "vue";
import { useDrive } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Delete from "@iconify-icons/ep/delete";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import Failed from "@iconify-icons/ep/failed";
import Lock from "@iconify-icons/ep/lock";
import { hasAuth } from "@/router/utils";
import AddFill from "@iconify-icons/ri/add-circle-line";
import ReQrcode from "@/components/ReQrcode";
import More from "@iconify-icons/ep/more-filled";
import EditPen from "@iconify-icons/ep/edit-pen";

defineOptions({
  name: "MoviesDrive"
});

const formRef = ref();
const tableRef = ref();
const {
  t,
  form,
  loading,
  columns,
  dataList,
  qrcodeInfo,
  pagination,
  sortOptions,
  buttonClass,
  manySelectCount,
  onSelectionCancel,
  onSearch,
  resetForm,
  handleAdd,
  openDialog,
  stopLoopCheck,
  handleDelete,
  handleClean,
  handleManyDelete,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = useDrive(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:MoviesDrive')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('MoviesDrive.userid')" prop="userid">
        <el-input
          v-model="form.user_id"
          :placeholder="t('MoviesDrive.verifyUserid')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('MoviesDrive.username')" prop="username">
        <el-input
          v-model="form.user_name"
          :placeholder="t('MoviesDrive.verifyUsername')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.remark')" prop="description">
        <el-input
          v-model="form.description"
          :placeholder="t('labels.remark')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.sort')">
        <el-select
          v-model="form.ordering"
          style="width: 180px"
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
          type="primary"
          :icon="useRenderIcon(Search)"
          :loading="loading"
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
      :title="t('MoviesDrive.drive')"
      :columns="columns"
      @refresh="onSearch(true)"
    >
      <template #buttons>
        <el-space wrap>
          <div v-if="manySelectCount > 0" class="w-[360px]">
            <span
              style="font-size: var(--el-font-size-base)"
              class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
            >
              {{ t("buttons.hsselected", { count: manySelectCount }) }}
            </span>
            <el-button type="primary" text @click="onSelectionCancel">
              {{ t("buttons.hscancel") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('manyDelete:MoviesDrive')"
              :title="
                t('buttons.hsbatchdeleteconfirm', { count: manySelectCount })
              "
              @confirm="handleManyDelete"
            >
              <template #reference>
                <el-button type="danger" plain :icon="useRenderIcon(Delete)">
                  {{ t("buttons.hsbatchdelete") }}
                </el-button>
              </template>
            </el-popconfirm>
          </div>

          <el-popover
            v-if="
              hasAuth('get:MoviesDriveQrCode') &&
              hasAuth('check:MoviesDriveQrCode')
            "
            :width="260"
            :visible="qrcodeInfo.sid !== ''"
            placement="bottom"
            trigger="click"
          >
            <div style="text-align: center">
              <span>{{ t("MoviesDrive.scanHelp") }}</span>
              <ReQrcode v-if="qrcodeInfo.qrcode" :text="qrcodeInfo.qrcode" />
              <el-button size="small" @click="stopLoopCheck"
                >{{ t("labels.cancel") }}
              </el-button>
            </div>
            <template #reference>
              <el-button
                type="primary"
                :icon="useRenderIcon(AddFill)"
                @click="handleAdd('')"
              >
                {{ t("buttons.hsadd") }}
              </el-button>
            </template>
          </el-popover>
        </el-space>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          border
          align-whole="center"
          showOverflowTooltip
          table-layout="auto"
          :loading="loading"
          :size="size"
          adaptive
          row-key="pk"
          :data="dataList"
          :columns="dynamicColumns"
          :pagination="pagination"
          :paginationSmall="size === 'small'"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('update:MoviesDrive')"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon(EditPen)"
              @click="openDialog(row)"
            >
              {{ t("buttons.hsedit") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('delete:MoviesDrive')"
              :title="t('buttons.hsconfirmdelete')"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  link
                  type="danger"
                  :size="size"
                  :icon="useRenderIcon(Delete)"
                >
                  {{ t("buttons.hsdelete") }}
                </el-button>
              </template>
            </el-popconfirm>
            <el-popconfirm
              v-if="hasAuth('clean:MoviesDrive')"
              :title="t('MoviesDrive.confirmClean')"
              @confirm="handleClean(row)"
            >
              <template #reference>
                <el-button
                  link
                  type="danger"
                  :size="size"
                  :icon="useRenderIcon(Failed)"
                >
                  {{ t("MoviesDrive.clean") }}
                </el-button>
              </template>
            </el-popconfirm>
            <el-dropdown>
              <el-button
                class="ml-3 mt-[2px]"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(More)"
              />

              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="
                      hasAuth('get:MoviesDriveQrCode') &&
                      hasAuth('check:MoviesDriveQrCode')
                    "
                  >
                    <el-button
                      :class="buttonClass"
                      link
                      type="primary"
                      :size="size"
                      :icon="useRenderIcon(Lock)"
                      @click="handleAdd(row.user_id)"
                    >
                      {{ t("MoviesDrive.actActive") }}
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
</template>

<style scoped lang="scss">
:deep(.el-dropdown-menu__item i) {
  margin: 0;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
