import { ActivityStudio } from "@/components/activity-studio";
import { getCurrentIdentity } from "@/integrations/feishu/session";
import { redirect } from "next/navigation";

export default async function Page() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/api/auth/feishu/start");
  return (
    <ActivityStudio
      identity={{
        displayName: identity.displayName,
        provider: identity.provider
      }}
    />
  );
}
