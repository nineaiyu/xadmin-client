<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { CONDITION_OPS, type RouteItem } from "./flowConfig";

/**
 * 节点出口路由编辑（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 纯本地 state 编辑：组件持有 routes 副本，确认时由页面把过滤后的 routes 回写到节点
 * （自环 / 越界 target 过滤口径与原实现一致）。
 */
defineOptions({ name: "FlowRouteEditorForm" });

const props = defineProps<{
  /** 当前节点序号（1-based）与全部节点数：约束 target 范围与自环 */
  order: number;
  count: number;
  /** 路由副本（编辑中不影响节点，确认后由页面回写） */
  routes: RouteItem[];
}>();

const { t } = useI18n();
const routes = ref<RouteItem[]>(props.routes);

const addRoute = () => {
  routes.value.push({
    condition: { field: "", op: "eq", value: "" },
    target: 1
  });
};

/** 过滤自环与越界 target（与原实现同口径） */
const getRoutes = (): RouteItem[] =>
  routes.value.filter(
    route =>
      route.target >= 1 &&
      route.target <= props.count &&
      route.target !== props.order
  );

defineExpose({ getRoutes });
</script>

<template>
  <div>
    <el-alert
      :closable="false"
      type="info"
      :title="t('systemApprovalFlow.routesTip')"
      class="mb-3"
    />
    <el-table :data="routes" size="small" border>
      <el-table-column
        :label="t('systemApprovalFlow.conditionField')"
        width="150"
      >
        <template #default="{ row }">
          <el-input v-model="row.condition.field" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.conditionOp')" width="120">
        <template #default="{ row }">
          <el-select v-model="row.condition.op" size="small">
            <el-option
              v-for="op in CONDITION_OPS"
              :key="op"
              :label="op"
              :value="op"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.conditionValue')"
        width="150"
      >
        <template #default="{ row }">
          <el-input v-model="row.condition.value" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.routeTarget')">
        <template #default="{ row, $index }">
          <el-select v-model="row.target" size="small" class="w-45!">
            <el-option
              v-for="order in count"
              :key="order"
              :label="`${t('systemApprovalFlow.nodeOrder')} ${order}`"
              :value="order"
              :disabled="order === order"
            />
          </el-select>
          <el-button
            link
            type="danger"
            size="small"
            class="ml-1"
            @click="routes.splice($index, 1)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-button
      link
      type="primary"
      size="small"
      class="mt-2"
      @click="addRoute()"
    >
      {{ t("systemApprovalFlow.addRoute") }}
    </el-button>
  </div>
</template>
