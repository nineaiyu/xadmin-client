import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 校验失败明细形态（unknown-keys 带 keys / bad-value 带 key） */
type PackErrorDetail = { keys?: string[]; key?: string };

/** 校验失败原因 → 词条键（code 与 appearancePack.ts 对齐；unknown-keys/bad-value 带参数） */
const PACK_ERROR_KEY_BY_CODE: Record<string, string> = {
  "invalid-json": "layout.appearancePackBadJson",
  "wrong-type": "layout.appearancePackWrongType",
  "wrong-version": "layout.appearancePackWrongVersion",
  "empty-config": "layout.appearancePackEmpty",
  "unknown-keys": "layout.appearancePackUnknownKeys",
  "bad-value": "layout.appearancePackBadValue"
};

/** 外观包导入的校验失败原因 → 本地化文案（自 useAppearancePackActions 下沉，行数门禁） */
export function packErrorMessage(
  t: TFunction,
  code: string,
  detail?: PackErrorDetail
): string {
  const params =
    code === "unknown-keys"
      ? { keys: detail?.keys?.join(", ") ?? "" }
      : code === "bad-value"
        ? { key: detail?.key ?? "" }
        : {};
  return t(PACK_ERROR_KEY_BY_CODE[code], params);
}
