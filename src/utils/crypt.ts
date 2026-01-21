// import crypto from 'crypto';
// import dotenv from 'dotenv';

// dotenv.config(); // Load environment variables

// // Function to generate a secret key (once per day) with a salt
// function generateSecretKey4ThisDay(): Buffer {
//   try {
//     const date: Date = new Date();
//     const dateString: string = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

//     // Use a salt from the environment variable
//     const salt: string = process.env.SECRET_KEY_SALT || 'ANPH_SALT'; // Use a default salt if not provided

//     const key: string = crypto.createHash('sha256').update(dateString + salt).digest('hex');
//     return Buffer.from(key, 'hex');
//   } catch (error) {
//     console.error('Error generating secret key:', error);
//     throw error;
//   }
// }

// // Function to encrypt text
// export function encrypt(text: string): { iv: string, encryptedText: string, authTag: string } {
//   try {
//     const key: Buffer = generateSecretKey4ThisDay();
//     const iv: Buffer = crypto.randomBytes(16); // Initialization Vector
//     const cipher: crypto.CipherGCM = crypto.createCipheriv('aes-256-gcm', key, iv);

//     let encrypted: string = cipher.update(text, 'utf8', 'hex');
//     encrypted += cipher.final('hex');

//     const authTag: Buffer = cipher.getAuthTag();

//     return {
//       iv: iv.toString('hex'),
//       encryptedText: encrypted,
//       authTag: authTag.toString('hex'),
//     };
//   } catch (error) {
//     console.error('Error encrypting text:', error);
//     throw error;
//   }
// }

// // Function to decrypt text
// export function decrypt(encryptedData: { iv: string, encryptedText: string, authTag: string }): string {
//   try {
//     const key: Buffer = generateSecretKey4ThisDay();
//     const decipher: crypto.DecipherGCM = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedData.iv, 'hex'));

//     decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

//     let decrypted: string = decipher.update(encryptedData.encryptedText, 'hex', 'utf8');
//     decrypted += decipher.final('utf8');

//     return decrypted;
//   } catch (error) {
//     console.error('Error decrypting text:', error);
//     throw error;
//   }
// }