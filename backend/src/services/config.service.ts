import { supabase } from "../supabase";

export async function getConfig(
  key: string,
  defaultValue: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", key)
      .single();

    return data?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function getNumberConfig(
  key: string,
  defaultValue: number,
): Promise<number> {
  const value = await getConfig(key, String(defaultValue));
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
