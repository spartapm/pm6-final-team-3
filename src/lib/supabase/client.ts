import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qwihfnppdhhglxdfajem.supabase.co";
const supabasePublishableKey =
  "sb_publishable_r2B6Frg5O0LHJY-Qs1Lj9g_lVGWdZ7x";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
