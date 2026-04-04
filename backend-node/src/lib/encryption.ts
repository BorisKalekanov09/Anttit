import crypto from 'crypto';

/**
 * AES-256-GCM encryption for API keys
 * Master key from MASTER_ENCRYPTION_KEY env var
 * Each encrypted value includes its own IV (initialization vector)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits for key derivation

function getMasterKey(): Buffer {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('MASTER_ENCRYPTION_KEY environment variable not set');
  }
  
  if (key.length < 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
  }
  
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt sensitive data (API keys, tokens)
 * Returns: iv:authTag:encrypted (all base64, separated by colons)
 */
export function encrypt(plaintext: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  const iv64 = iv.toString('base64');
  const tag64 = authTag.toString('base64');
  const enc64 = Buffer.from(encrypted, 'hex').toString('base64');
  
  return `${iv64}:${tag64}:${enc64}`;
}

/**
 * Decrypt sensitive data
 * Input: iv:authTag:encrypted (base64 format)
 */
export function decrypt(ciphertext: string): string {
  const masterKey = getMasterKey();
  const parts = ciphertext.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }
  
  const [iv64, tag64, enc64] = parts;
  
  try {
    const iv = Buffer.from(iv64, 'base64');
    const authTag = Buffer.from(tag64, 'base64');
    const encrypted = Buffer.from(enc64, 'base64').toString('hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a hash of sensitive data for duplicate detection
 * (never store plaintext, always hash for comparison)
 */
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validate encryption key strength
 */
export function validateEncryptionKey(): { valid: boolean; message: string } {
  try {
    getMasterKey();
    return { valid: true, message: 'Encryption key is valid' };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a new random encryption key (32 bytes = 256 bits)
 * Use this to bootstrap MASTER_ENCRYPTION_KEY
 */
export function generateNewKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
