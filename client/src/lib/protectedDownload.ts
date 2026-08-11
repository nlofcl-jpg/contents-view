import { supabase } from "@/lib/supabase";

export const FLOW_AUTOMATION_DOWNLOAD_API = "/api/download-flow-automation";
export const FLOW_AUTOMATION_FILE_NAME = "CONTENTS-VIEW-flow-automation.zip";

export async function downloadFlowAutomationFile() {
  if (!supabase) {
    throw new Error("로그인 설정을 확인해주세요.");
  }

  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(FLOW_AUTOMATION_DOWNLOAD_API, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as {
      message?: string;
    } | null;
    throw new Error(payload?.message || "다운로드를 시작하지 못했습니다.");
  }

  const blobUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = FLOW_AUTOMATION_FILE_NAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
