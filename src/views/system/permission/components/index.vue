<script lang="ts" setup>
import { ref, watch } from "vue";
import { useFieldRule } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AddFill from "~icons/ri/add-circle-line";
import TrialPanel from "./TrialPanel.vue";
import { FormProps } from "./utils/types";
import EditPen from "~icons/ep/edit-pen";
import Delete from "~icons/ep/delete";
import CopyDocument from "~icons/ri/file-copy-line";
import { hasAuth } from "@/router/utils";
import PureTable from "@pureadmin/table";

const props = withDefaults(defineProps<FormProps>(), {
  valuesData: () => [],
  dataList: () => [],
  ruleList: () => [],
  menus: () => []
});

const emit = defineEmits<{ change: [v: Array<object>] }>();
const tableRef = ref();
const { t, columns, openDialog, handleDelete, handleCopy, ruleInfo } =
  useFieldRule(props.ruleList, props.dataList, props.valuesData);

/** 规则行主键：表__字段__匹配 唯一确定一条规则（原 row-key="name" 字段不存在，行复用会错乱） */
const ruleRowKey = (row: { table: string; field: string; match: string }) =>
  `${row.table}__${row.field}__${row.match}`;

watch(ruleInfo.value, () => {
  emit("change", Object.values(ruleInfo.value));
});
</script>

<template>
  <div class="w-full">
    <PureTableBar :columns="columns" :title="t('systemPermission.rules')">
      <template v-if="hasAuth('list:SystemModelLabelField')" #buttons>
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
          {{ t("buttons.add") }}
        </el-button>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          :columns="dynamicColumns"
          class="min-h-60"
          :data="Object.values(ruleInfo)"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :size="size"
          adaptive
          align-whole="center"
          :row-key="ruleRowKey"
          showOverflowTooltip
          table-layout="auto"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('list:SystemModelLabelField')"
              :icon="useRenderIcon(EditPen)"
              :size="size"
              class="reset-margin"
              link
              type="primary"
              @click="openDialog(row)"
            />
            <el-button
              v-if="hasAuth('list:SystemModelLabelField')"
              v-tippy="t('systemPermission.copyRule')"
              :icon="useRenderIcon(CopyDocument)"
              :size="size"
              class="reset-margin"
              link
              type="primary"
              @click="handleCopy(row)"
            />
            <el-popconfirm
              :title="t('buttons.confirmDelete')"
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
    <!-- 即时试算：用当前未保存的规则草稿验证影响面（不落库） -->
    <TrialPanel
      :menus="props.menus"
      :rule-list="props.ruleList"
      :rules="Object.values(ruleInfo)"
    />
  </div>
</template>
