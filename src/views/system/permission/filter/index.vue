<script lang="ts" setup>
import { ref, watch } from "vue";
import { useFieldRule } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AddFill from "@iconify-icons/ri/add-circle-line";
import { FormProps } from "./utils/types";
import EditPen from "@iconify-icons/ep/edit-pen";
import Delete from "@iconify-icons/ep/delete";
import { hasGlobalAuth } from "@/router/utils";

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
    <PureTableBar :columns="columns" :title="t('permission.rules')">
      <template v-if="hasGlobalAuth('list:systemModelField')" #buttons>
        <el-button
          :icon="useRenderIcon(AddFill)"
          type="primary"
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
          :columns="dynamicColumns"
          :data="Object.values(ruleInfo)"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :paginationSmall="size === 'small'"
          :size="size"
          adaptive
          align-whole="center"
          border
          row-key="name"
          showOverflowTooltip
          table-layout="auto"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasGlobalAuth('list:systemModelField')"
              :icon="useRenderIcon(EditPen)"
              :size="size"
              class="reset-margin"
              link
              type="primary"
              @click="openDialog(row)"
            />
            <el-popconfirm
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
                />
              </template>
            </el-popconfirm>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>
