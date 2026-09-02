import crypto from "node:crypto";
import input from "../tests/fixtures/employee-activity.normal.json";
import { employeeActivityInputSchema } from "../src/contracts/poster";
import { generateCopy } from "../src/providers/copy-provider";
import { generateIllustration } from "../src/providers/illustration-provider";
import { compileIllustrationBrief } from "../src/providers/prompt-compiler";
import { renderEmployeeActivity } from "../src/templates/employee-activity";
async function main() { const id = crypto.randomUUID(); const data = employeeActivityInputSchema.parse(input); const { document } = await generateCopy(data); const { brief } = await compileIllustrationBrief(data); const illustration = await generateIllustration(brief, id); const file = await renderEmployeeActivity(document, illustration.path, id); console.log(`Rendered ${file}`); }
void main();
