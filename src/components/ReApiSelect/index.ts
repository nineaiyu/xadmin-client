import reApiSelect from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 远程取数的下拉选择（选项由 api 拉取并归一） */
export const ReApiSelect = withInstall(reApiSelect);

export default ReApiSelect;
export type {
  ApiOption,
  ApiOptionsConfig,
  ApiOptionValue
} from "./src/useApiOptions";
export { useApiOptions } from "./src/useApiOptions";
