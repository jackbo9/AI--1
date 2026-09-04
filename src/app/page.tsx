import { ActivityStudio } from "@/components/activity-studio";
import { getCurrentIdentity } from "@/integrations/feishu/session";
import { serverEnv } from "@/lib/env";
import { redirect } from "next/navigation";

// Identity depends on runtime configuration and the current session cookie.
// Never pre-render a local demo identity into a production build.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/api/auth/feishu/start");
  const fixtureMode =
    serverEnv.AUTH_MODE === "local" && (await searchParams).fixture === "1";
  return (
    <ActivityStudio
      fixtureMode={fixtureMode}
      identity={{
        displayName: identity.displayName,
        provider: identity.provider
      }}
    />
  );
}
