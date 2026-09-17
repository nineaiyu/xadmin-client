import "./circled.css";
import Cropper from "cropperjs";
import { ElUpload } from "element-plus";
import type { CSSProperties, Ref } from "vue";
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  unref
} from "vue";
import { useEventListener } from "@vueuse/core";
import { longpress } from "@/directives/longpress";
import { directive as tippy, useTippy } from "vue-tippy";
import {
  debounce,
  delay,
  downloadByBase64,
  isArray,
  useResizeObserver
} from "@pureadmin/utils";
import {
  ArrowDown,
  ArrowH,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowV,
  ChangeIcon,
  DownloadIcon,
  Reload,
  RotateLeft,
  RotateRight,
  SearchMinus,
  SearchPlus,
  Upload
} from "./svg";
import { useI18n } from "vue-i18n";

import {
  buildImageStyle,
  buildWrapperStyle,
  cropperProps,
  defaultOptions,
  getRoundedCanvas,
  resolveImageQuality
} from "./utils";

export default defineComponent({
  name: "ReCropper",
  props: cropperProps,
  setup(props, { attrs, emit }) {
    const tippyElRef = ref<ElRef<HTMLImageElement>>();
    const imgElRef = ref<ElRef<HTMLImageElement>>();
    const cropper = ref<Nullable<Cropper>>();
    const inCircled = ref(props.circled);
    const isInClose = ref(props.isClose);
    const inSrc = ref(props.src);
    const isReady = ref(false);
    const imgBase64 = ref();

    let scaleX = 1;
    let scaleY = 1;
    const onImageError = () => {
      inSrc.value = props.errSrc;
      cropper.value?.destroy();
      delay(400).then(() => {
        init();
      });
    };
    const debounceRealTimeCroppered = debounce(realTimeCroppered, 80);
    const { t } = useI18n();
    const getImageStyle = computed((): CSSProperties =>
      buildImageStyle(props.height, props.imageStyle)
    );

    const getClass = computed(() => {
      return [
        attrs.class,
        {
          ["re-circled"]: inCircled.value
        }
      ];
    });

    const iconClass = computed(() => {
      return [
        "p-1.5",
        "size-7.5",
        "rounded-sm",
        "outline-hidden",
        "cursor-pointer",
        "hover:bg-fill_color"
      ];
    });

    const getWrapperStyle = computed((): CSSProperties =>
      buildWrapperStyle(props.height)
    );

    onMounted(init);

    onUnmounted(() => {
      cropper.value?.destroy();
      isReady.value = false;
      cropper.value = null;
      imgBase64.value = "";
      scaleX = 1;
      scaleY = 1;
    });

    useResizeObserver(tippyElRef as unknown as Ref<HTMLDivElement>, () =>
      handCropper("reset")
    );

    async function init() {
      const imgEl = unref(imgElRef);
      if (!imgEl) return;
      cropper.value = new Cropper(imgEl, {
        ...defaultOptions,
        ready: () => {
          isReady.value = true;
          realTimeCroppered();
          delay(400).then(() => emit("readied", cropper.value));
        },
        crop() {
          debounceRealTimeCroppered();
        },
        zoom() {
          debounceRealTimeCroppered();
        },
        cropmove() {
          debounceRealTimeCroppered();
        },
        ...props.options
      });
    }

    function realTimeCroppered() {
      if (props.realTimePreview) {
        croppered();
      }
    }

    function croppered() {
      if (!cropper.value) return;
      const sourceCanvas = cropper.value!.getCroppedCanvas(props.canvasOption);
      const canvas = inCircled.value
        ? getRoundedCanvas(sourceCanvas)
        : sourceCanvas;
      const { quality, type } = resolveImageQuality(
        canvas,
        props.quality,
        props.type
      );
      // https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toBlob
      canvas.toBlob(
        blob => {
          if (!blob) return;
          const fileReader: FileReader = new FileReader();
          fileReader.readAsDataURL(blob);
          fileReader.onloadend = e => {
            if (!e.target?.result || !blob) return;
            imgBase64.value = e.target.result;
            emit("cropper", {
              base64: e.target.result,
              blob,
              // info: { size: blob.size, ...cropper.value.getData() }
              info: {
                size: blob.size,
                width: canvas.width,
                height: canvas.height
              }
            });
          };
          fileReader.onerror = () => {
            emit("error");
          };
        },
        type,
        quality
      );
    }

    function handCropper(event: string, arg?: number | Array<number>) {
      if (event === "scaleX") {
        scaleX = arg = scaleX === -1 ? 1 : -1;
      }

      if (event === "scaleY") {
        scaleY = arg = scaleY === -1 ? 1 : -1;
      }
      const cropperApi = cropper.value as unknown as Record<
        string,
        ((...args: unknown[]) => void) | undefined
      >;
      if (arg && isArray(arg)) {
        cropperApi?.[event]?.(...arg);
      } else {
        cropperApi?.[event]?.(arg);
      }
    }

    function beforeUpload(file: File) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      inSrc.value = "";
      reader.onload = (e: ProgressEvent<FileReader>) => {
        inSrc.value = e.target?.result as string;
      };
      reader.onloadend = () => {
        init();
      };
      return false;
    }

    const menuContent = defineComponent({
      directives: {
        tippy,
        longpress
      },
      setup() {
        return () => (
          <div class="flex flex-wrap w-15 justify-between">
            <ElUpload
              accept="image/*"
              show-file-list={false}
              before-upload={beforeUpload}
            >
              <Upload
                class={iconClass.value}
                v-tippy={{
                  content: t("cropper.upload"),
                  placement: "left-start"
                }}
              />
            </ElUpload>
            <DownloadIcon
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.download"),
                placement: "right-start"
              }}
              onClick={() => downloadByBase64(imgBase64.value, "cropping.png")}
            />
            <ChangeIcon
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.change"),
                placement: "left-start"
              }}
              onClick={() => {
                inCircled.value = !inCircled.value;
                realTimeCroppered();
              }}
            />
            <Reload
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.reset"),
                placement: "right-start"
              }}
              onClick={() => handCropper("reset")}
            />
            <ArrowUp
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.up"),
                placement: "left-start"
              }}
              v-longpress={[() => handCropper("move", [0, -10]), "0:100"]}
            />
            <ArrowDown
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.down"),
                placement: "right-start"
              }}
              v-longpress={[() => handCropper("move", [0, 10]), "0:100"]}
            />
            <ArrowLeft
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.left"),
                placement: "left-start"
              }}
              v-longpress={[() => handCropper("move", [-10, 0]), "0:100"]}
            />
            <ArrowRight
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.right"),
                placement: "right-start"
              }}
              v-longpress={[() => handCropper("move", [10, 0]), "0:100"]}
            />
            <ArrowH
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.flipHorizontal"),
                placement: "left-start"
              }}
              onClick={() => handCropper("scaleX", -1)}
            />
            <ArrowV
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.flipVertical"),
                placement: "right-start"
              }}
              onClick={() => handCropper("scaleY", -1)}
            />
            <RotateLeft
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.anticlockwise"),
                placement: "left-start"
              }}
              onClick={() => handCropper("rotate", -45)}
            />
            <RotateRight
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.clockwise"),
                placement: "right-start"
              }}
              onClick={() => handCropper("rotate", 45)}
            />
            <SearchPlus
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.zoomIn"),
                placement: "left-start"
              }}
              v-longpress={[() => handCropper("zoom", 0.1), "0:100"]}
            />
            <SearchMinus
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.zoomOut"),
                placement: "right-start"
              }}
              v-longpress={[() => handCropper("zoom", -0.1), "0:100"]}
            />
          </div>
        );
      }
    });

    function onContextmenu(event: MouseEvent) {
      event.preventDefault();

      const { show, setProps, destroy, state } = useTippy(tippyElRef, {
        content: menuContent,
        arrow: false,
        theme: "light",
        trigger: "manual",
        interactive: true,
        appendTo: "parent",
        // hideOnClick: false,
        placement: "bottom-end"
      });

      setProps({
        getReferenceClientRect: () => ({
          width: 0,
          height: 0,
          top: event.clientY,
          bottom: event.clientY,
          left: event.clientX,
          right: event.clientX
        })
      });

      show();

      if (isInClose.value) {
        if (!state.value.isShown && !state.value.isVisible) return;
        useEventListener(tippyElRef, "click", destroy);
      }
    }

    return {
      inSrc,
      props,
      imgElRef,
      tippyElRef,
      getClass,
      getWrapperStyle,
      getImageStyle,
      isReady,
      onImageError,
      croppered,
      onContextmenu
    };
  },

  render() {
    const {
      inSrc,
      isReady,
      onImageError,
      getClass,
      getImageStyle,
      onContextmenu,
      getWrapperStyle
    } = this;
    const { alt, crossorigin } = this.props;

    return inSrc ? (
      <div
        ref="tippyElRef"
        class={getClass}
        style={getWrapperStyle}
        onContextmenu={event => onContextmenu(event)}
      >
        <img
          v-show={isReady}
          ref="imgElRef"
          style={getImageStyle}
          src={inSrc}
          alt={alt}
          onError={onImageError}
          crossorigin={crossorigin}
        />
      </div>
    ) : null;
  }
});
