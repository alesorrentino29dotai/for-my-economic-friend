import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serviceDir, "../../../..");

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

export const dataDir = resolveFromRoot(process.env.DATA_DIR ?? "data");
export const uploadDir = resolveFromRoot(
  process.env.UPLOAD_DIR ?? path.join("data", "uploads")
);
export const documentsDbPath = path.join(dataDir, "documents.json");
export const aiConfigPath = path.join(dataDir, "ai-config.json");
