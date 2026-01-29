const crypto = require('crypto');

const secret = process.env.JWT_SECRET || 'fallback_secret_key_32_chars_long_!!';
// Ensure key length is 32 for aes-256-ctr
const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);

const encrypt = (text) => {
    try {
        if (!text) return text;
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
        return {
            iv: iv.toString('hex'),
            content: encrypted.toString('hex')
        };
    } catch (e) {
        console.error("Encryption error", e);
        return null;
    }
};

const decrypt = (hash) => {
    try {
        if (!hash || !hash.iv || !hash.content) return null;
        const decipher = crypto.createDecipheriv('aes-256-ctr', key, Buffer.from(hash.iv, 'hex'));
        const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
        return decrpyted.toString();
    } catch (e) {
        console.error("Decryption error", e);
        return null;
    }
};

module.exports = { encrypt, decrypt };
