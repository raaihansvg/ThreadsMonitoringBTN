import { IngestInput, IngestResult, InputSource } from "./types";

export const PREVIEW_FALLBACK_MESSAGE =
  "Teks tidak dapat diambil otomatis. Tempel teks postingan.";

/**
 * FR-02: Untuk tautan nyata, sistem TIDAK PERNAH menyimulasikan teks secara otomatis.
 * Bila pratinjau gagal/belum tersedia, kembalikan pesan instruksi dan biarkan teks kosong.
 */
export class StubInputSource implements InputSource {
  async fetch(_input: IngestInput): Promise<IngestResult> {
    void _input;
    return {
      ok: false,
      text: "",
      error: PREVIEW_FALLBACK_MESSAGE,
    };
  }
}

export function getPreviewFallback(url?: string): {
  success: boolean;
  text: string;
  message: string;
} {
  void url;
  return {
    success: false,
    text: "",
    message: PREVIEW_FALLBACK_MESSAGE,
  };
}
