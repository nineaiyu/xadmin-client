<script lang="ts" setup>
import type { DrawerOptions, EventType, ArgsType } from "./type";
import { closeDrawer, drawerStore, getDrawerUid } from "./store";
import { isFunction } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { useOverlayFooter } from "@/components/overlay/useOverlayFooter";
import { useOverlayScrollLock } from "@/components/overlay/useOverlayScrollLock";

defineOptions({
  name: "ReDrawer"
});

const { t } = useI18n();

useOverlayScrollLock(drawerStore);

const {
  sureBtnMap,
  footerButtons,
  handleBeforeClose,
  handleClose: closeOverlay
} = useOverlayFooter<DrawerOptions>({
  close: closeDrawer,
  getUid: getDrawerUid,
  t,
  allowDeprecatedPopConfirm: true
});

function eventsCallBack(
  event: EventType,
  options: DrawerOptions,
  index: number
) {
  if (options?.[event] && isFunction(options?.[event])) {
    return options?.[event]({ options, index });
  }
}

function handleCloseDrawer(
  options: DrawerOptions,
  index: number,
  args?: ArgsType
) {
  closeOverlay(options, index, args);
}

function handleClose(
  options: DrawerOptions,
  index: number,
  args: ArgsType = { command: "close" }
) {
  handleCloseDrawer(options, index, args);
  eventsCallBack("close", options, index);
}

function handleChange(options: DrawerOptions, index: number, values: unknown) {
  options?.onChange && options.onChange({ options, index, values });
}

/**
 * 内容组件 props：既有 `options.props` + （启用载荷通道时）注入 `getData/setData`。
 * 仅在显式传入 `payload` 的抽屉注入，未传的抽屉零影响
 * （避免未声明这两个 props 的内容组件把它们落到根元素 DOM 上）。
 */
function contentProps(options: DrawerOptions) {
  if (!options.getData && !options.setData) return options?.props;
  return {
    ...options?.props,
    getData: options.getData,
    setData: options.setData
  };
}
</script>

<template>
  <el-drawer
    v-for="(options, index) in drawerStore"
    :key="getDrawerUid(options) ?? index"
    v-model="options.visible"
    :append-to="options?.appendTo ? options.appendTo : 'body'"
    class="pure-drawer"
    v-bind="options"
    :close-on-press-escape="options.closeOnPressEscape ?? true"
    :before-close="
      (done: (cancel?: boolean) => void) => handleBeforeClose(options, done)
    "
    @closed="handleClose(options, index)"
    @opened="eventsCallBack('open', options, index)"
    @open-auto-focus="eventsCallBack('openAutoFocus', options, index)"
    @close-auto-focus="eventsCallBack('closeAutoFocus', options, index)"
  >
    <!-- header  -->
    <template
      v-if="options?.headerRenderer"
      #header="{ close, titleId, titleClass }"
    >
      <component
        :is="options?.headerRenderer?.({ close, titleId, titleClass })"
      />
    </template>
    <!--  body  -->
    <component
      :is="options.contentRenderer?.({ options, index })"
      v-bind="contentProps(options)"
      @change="(values: unknown) => handleChange(options, index, values)"
      @close="(args: ArgsType) => handleClose(options, index, args)"
    />
    <!-- footer  -->
    <template v-if="!options?.hideFooter" #footer>
      <template v-if="options?.footerRenderer">
        <component :is="options?.footerRenderer({ options, index })" />
      </template>
      <span v-else>
        <template v-for="(btn, key) in footerButtons(options)" :key="key">
          <el-popconfirm
            v-if="btn.popconfirm ?? btn.popConfirm"
            v-bind="btn.popconfirm ?? btn.popConfirm"
            @confirm="
              btn.btnClick?.({
                drawer: { options, index },
                button: { btn, index: key }
              })
            "
          >
            <template #reference>
              <el-button v-bind="btn">{{ btn?.label }}</el-button>
            </template>
          </el-popconfirm>
          <el-button
            v-else
            :loading="
              btn.code === 'sure' &&
              sureBtnMap[getDrawerUid(options) ?? index]?.loading
            "
            v-bind="btn"
            @click="
              btn.btnClick?.({
                drawer: { options, index },
                button: { btn, index: key }
              })
            "
          >
            {{ btn?.label }}
          </el-button>
        </template>
      </span>
    </template>
  </el-drawer>
</template>
