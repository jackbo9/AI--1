import { ActivityStudio } from "@/components/activity-studio";
import { getCurrentIdentity } from "@/integrations/feishu/session";
import { redirect } from "next/navigation";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/api/auth/feishu/start");
  const fixtureMode = (await searchParams).fixture === "1";
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
