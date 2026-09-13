import { objectStorage } from "@/providers/object-storage";
import { prisma } from "./prisma";
import { purgeDeletedJobs } from "./postgres-job-repository";

export async function runStorageMaintenance(now = new Date()) {
  const pending = await prisma.storageCleanup.findMany();
  for (const item of pending) {
    try {
      await objectStorage().deleteObject(item.objectKey);
      await prisma.storageCleanup.delete({ where: { objectKey: item.objectKey } });
    } catch { /* Retry on the next daily run. */ }
  }
  const expired = await prisma.visualAsset.findMany({ where: { selected: false, expiresAt: { lte: now } } });
  let deletedObjects = 0;
  for (const asset of expired) {
    try {
      await objectStorage().deleteObject(asset.objectKey);
      await prisma.visualAsset.delete({ where: { id: asset.id } });
      deletedObjects += 1;
    } catch { /* Keep the asset record so the next run can retry. */ }
  }
  const purged = await purgeDeletedJobs(now);
  for (const objectKey of purged.objectKeys) {
    try {
      await objectStorage().deleteObject(objectKey);
      await prisma.storageCleanup.delete({ where: { objectKey } }).catch(() => undefined);
      deletedObjects += 1;
    } catch { /* Keep the cleanup row for the next daily run. */ }
  }
  return { pendingObjects: pending.length, expiredAssets: expired.length, purgedJobs: purged.jobIds.length, deletedObjects };
}
