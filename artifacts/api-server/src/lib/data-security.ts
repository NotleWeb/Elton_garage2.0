import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENC_PREFIX = "enc:v1";
const ENC_ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

type CollectionConfig = {
  encryptedFields: string[];
  hashFromFields?: Record<string, string>;
};

const COLLECTION_SECURITY: Record<string, CollectionConfig> = {
  users: {
    encryptedFields: ["email"],
    hashFromFields: {
      email_hash: "email",
    },
  },
  customers: {
    encryptedFields: ["phone", "whatsapp", "email", "address", "notes"],
    hashFromFields: {
      email_hash: "email",
      phone_hash: "phone",
      whatsapp_hash: "whatsapp",
    },
  },
  vehicles: {
    encryptedFields: ["plate"],
  },
};

export const SECURED_COLLECTIONS = Object.keys(COLLECTION_SECURITY);

function getKeyBuffer(): Buffer {
  const raw = process.env["DATA_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error("DATA_ENCRYPTION_KEY environment variable is required for data protection");
  }

  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) {
    return base64;
  }

  return createHash("sha256").update(trimmed, "utf8").digest();
}

function normalizeLookupValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function hashLookupValue(value: unknown): string | null {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function isEncryptedValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${ENC_PREFIX}:`);
}

function encryptValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  if (isEncryptedValue(value)) return value;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENC_ALGO, getKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

function decryptValue(value: unknown): unknown {
  if (!isEncryptedValue(value)) return value;

  const parts = value.split(":");
  if (parts.length !== 5) return value;

  try {
    const iv = Buffer.from(parts[2], "base64");
    const encrypted = Buffer.from(parts[3], "base64");
    const tag = Buffer.from(parts[4], "base64");

    const decipher = createDecipheriv(ENC_ALGO, getKeyBuffer(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return value;
  }
}

export function getLookupHash(value: unknown): string | null {
  return hashLookupValue(value);
}

export function secureDataForWrite(collection: string, input: Record<string, unknown>): Record<string, unknown> {
  const config = COLLECTION_SECURITY[collection];
  if (!config) return input;

  const output: Record<string, unknown> = { ...input };

  for (const field of config.encryptedFields) {
    if (Object.prototype.hasOwnProperty.call(output, field)) {
      output[field] = encryptValue(output[field]);
    }
  }

  if (config.hashFromFields) {
    for (const [hashField, sourceField] of Object.entries(config.hashFromFields)) {
      if (!Object.prototype.hasOwnProperty.call(output, sourceField)) continue;
      const hash = hashLookupValue(output[sourceField]);
      output[hashField] = hash;
    }
  }

  return output;
}

export function secureDataForRead(collection: string, input: Record<string, unknown>): Record<string, unknown> {
  const config = COLLECTION_SECURITY[collection];
  if (!config) return input;

  const output: Record<string, unknown> = { ...input };

  for (const field of config.encryptedFields) {
    if (Object.prototype.hasOwnProperty.call(output, field)) {
      output[field] = decryptValue(output[field]);
    }
  }

  return output;
}
