<script setup lang="ts">
import { ref, watch } from "vue";
import { useFieldRule } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AddFill from "@iconify-icons/ri/add-circle-line";
import { FormProps } from "./utils/types";
import EditPen from "@iconify-icons/ep/edit-pen";
import Delete from "@iconify-icons/ep/delete";
import { hasAuth } from "@/router/utils";

const props = withDefaults(defineProps<FormProps>(), {
  valuesData: () => [],
  dataList: () => [],
  ruleList: () => []
});

const emit = defineEmits<{ (e: "update:dataList", v: Array<object>) }>();
const tableRef = ref();
const { t, columns, openDialog, handleDelete, ruleInfo } = useFieldRule(
  props.ruleList,
  props.dataList,
  props.valuesData
);

watch(ruleInfo.value, () => {
  emit("update:dataList", Object.values(ruleInfo.value));
});
</script>

<template>
  <div class="main">
    <PureTableBar :title="t('permission.rules')" :columns="columns">
      <template v-if="hasAuth('list:systemDataPermissionFields')" #buttons>
        <el-button
          type="primary"
          :icon="useRenderIcon(AddFill)"
          @click="
            openDialog({
              match: '',
              type: 'value.text',
              value: ''
            })
          "
        >
          {{ t("buttons.hsadd") }}
        </el-button>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          border
          align-whole="center"
          showOverflowTooltip
          table-layout="auto"
          :size="size"
          adaptive
          row-key="name"
          :data="Object.values(ruleInfo)"
          :columns="dynamicColumns"
          :paginationSmall="size === 'small'"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('list:systemDataPermissionFields')"
              class="reset-margin"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon(EditPen)"
              @click="openDialog(row)"
            />
            <el-popconfirm
              :title="t('buttons.hsconfirmdelete')"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  class="reset-margin"
                  link
                  type="danger"
                  :size="size"
                  :icon="useRenderIcon(Delete)"
                />
              </template>
            </el-popconfirm>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>
