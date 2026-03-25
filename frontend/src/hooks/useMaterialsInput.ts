import { useMemo, useState } from "react";
import { parseMaterialsInput } from "../utils/materials";

const DEFAULT_EXAMPLE = "Fita isolante 20m\nLâmpada LED 9w\nVeda rosca";

export function useMaterialsInput() {
  const [value, setValue] = useState(DEFAULT_EXAMPLE);

  const parsedItems = useMemo(() => parseMaterialsInput(value), [value]);

  return {
    value,
    setValue,
    parsedItems,
    isValid: parsedItems.length > 0,
    itemCount: parsedItems.length
  };
}
