import type { El } from "typeit/dist/types";
import TypeIt, { type Options as TypeItOptions } from "typeit";
import { defineComponent, onMounted, type PropType, ref } from "vue";
import { useI18n } from "vue-i18n";

// 打字机效果组件（配置项详情请查阅 https://www.typeitjs.com/docs/vanilla/usage#options）
export default defineComponent({
  name: "TypeIt",
  props: {
    options: {
      type: Object as PropType<TypeItOptions>,
      default: () => ({}) as TypeItOptions
    }
  },
  setup(props, { slots, expose }) {
    const { t } = useI18n();
    /**
     * 输出错误信息
     * @param message 错误信息
     */
    function throwError(message: string) {
      throw new TypeError(message);
    }

    const typedItRef = ref<Element | null>(null);

    onMounted(() => {
      const $typed = typedItRef.value!.querySelector(".type-it") as El;

      if (!$typed) {
        throwError(t("login.typeItSingleElement"));
      }

      const typeIt = new TypeIt($typed, props.options).go();

      expose({
        typeIt
      });
    });

    return () => (
      <div ref={typedItRef}>
        {slots.default?.() ?? <span class="type-it"></span>}
      </div>
    );
  }
});
