/**
 * Penyamaran Data Pribadi / PII (AC-05 & FR-08)
 *
 * AC-05: Teks berisi nomor telepon, email, nomor identitas, atau nomor rekening
 * disamarkan atau ditolak, dan tidak pernah dikirim ke LLM dalam bentuk asli.
 */

export interface MaskPiiResult {
  maskedText: string;
  hasPii: boolean;
  detectedTypes: string[];
}

export function maskPii(inputText: string): MaskPiiResult {
  if (!inputText || typeof inputText !== "string") {
    return { maskedText: "", hasPii: false, detectedTypes: [] };
  }

  let text = inputText;
  const detectedTypes: string[] = [];

  // 1. Email: contoh nasabah@gmail.com, user.btn@yahoo.co.id
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  if (emailRegex.test(text)) {
    detectedTypes.push("EMAIL");
    text = text.replace(emailRegex, "[EMAIL_TERSEMBUNYI]");
  }

  // 2. Nomor Telepon Indonesia: +628..., 08..., format bertanda hubung mis. 0812-3456-7890
  const phoneRegex = /(?:\+62|62|08)[0-9\s-]{7,15}[0-9]/g;
  if (phoneRegex.test(text)) {
    detectedTypes.push("NOMOR_TELEPON");
    text = text.replace(phoneRegex, "[NOMOR_TELEPON_TERSEMBUNYI]");
  }

  // 3. Nomor Identitas / NIK KTP Indonesia (16 digit angka berturut-turut)
  const nikRegex = /\b[1-9][0-9]{15}\b/g;
  if (nikRegex.test(text)) {
    detectedTypes.push("NOMOR_IDENTITAS");
    text = text.replace(nikRegex, "[NIK_TERSEMBUNYI]");
  }

  // 4. Nomor Rekening Bank (10 sampai 15 digit angka berturut-turut)
  // Catatan: dijalankan setelah NIK agar NIK 16 digit tidak terpotong sebagian
  const rekRegex = /\b\d{10,15}\b/g;
  if (rekRegex.test(text)) {
    detectedTypes.push("NOMOR_REKENING");
    text = text.replace(rekRegex, "[NOMOR_REKENING_TERSEMBUNYI]");
  }

  return {
    maskedText: text,
    hasPii: detectedTypes.length > 0,
    detectedTypes,
  };
}
