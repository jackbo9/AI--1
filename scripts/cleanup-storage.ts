import { serverEnv } from "../src/lib/env";
import { runStorageMaintenance } from "../src/server/storage-maintenance";

if (!serverEnv.DATABASE_URL) throw new Error("DATABASE_URL 未配置，未执行清理");
runStorageMaintenance().then((result) => { console.log(JSON.stringify(result)); process.exit(0); }, (error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
