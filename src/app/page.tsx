import { ActivityStudio } from "@/components/activity-studio";
import { getCurrentIdentity } from "@/integrations/feishu/session";
import { serverEnv } from "@/lib/env";
import { redirect } from "next/navigation";
import { findTeaJob } from "@/server/job-store";
import { teaScene } from "@/contracts/tea";

// Identity depends on runtime configuration and the current session cookie.
// Never pre-render a local demo identity into a production build.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ fixture?: string; scene?: string; job?: string; view?: string }>;
}) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/api/auth/feishu/start");
  const query = await searchParams;
  const fixtureMode = serverEnv.AUTH_MODE === "local" && query.fixture === "1";
  const teaJob = query.job ? await findTeaJob(query.job) : undefined;
  const initialTea = query.scene === teaScene || Boolean(teaJob && teaJob.userId === identity.userId);
  return (
    <ActivityStudio
      fixtureMode={fixtureMode}
      initialTea={initialTea}
      initialTeaJobId={initialTea ? query.job : undefined}
      initialHistory={query.view === "history"}
      identity={{
        displayName: identity.displayName,
        provider: identity.provider
      }}
    />
  );
}
