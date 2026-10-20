import { z } from "zod";
import {
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
} from "@prisma/client";

/**
 * Validasi Skema Payload untuk Semua Rute Tulis (Tahap 1.6)
 */

export const createMentionSchema = z
  .object({
    linkAsli: z
      .string({ required_error: "Tautan Threads wajib diisi." })
      .min(1, "Tautan Threads tidak boleh kosong.")
      .max(2048, "Tautan terlalu panjang (maksimal 2048 karakter)."),
    teksPostingan: z
      .string()
      .max(5000, "Teks postingan melebihi batas (maksimal 5000 karakter).")
      .default(""),
    topik: z.string().max(100).optional(),
    sentimen: z.nativeEnum(Sentiment).optional(),
    prioritas: z.nativeEnum(Priority).optional(),
    status: z.nativeEnum(MentionStatus).optional(),
    headline: z
      .string()
      .max(100, "Panjang headline maksimal 100 karakter.")
      .optional(),
    ringkasan: z
      .string()
      .max(400, "Panjang ringkasan maksimal 400 karakter.")
      .optional(),
    kataKunci: z.array(z.string().max(50)).max(30).optional(),
    penyediaAnalisis: z.string().max(50).optional(),
    sumberInput: z.nativeEnum(InputSourceType).optional(),
    linkTernormalisasi: z.string().max(2048).optional(),
    statusKanonik: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      // Jika status diset ke selain DRAF (misalnya BARU, DIPANTAU, SELESAI), teks postingan wajib diisi
      if (data.status && data.status !== MentionStatus.DRAF) {
        return data.teksPostingan.trim().length > 0;
      }
      return true;
    },
    {
      message:
        "Teks postingan wajib diisi untuk mention yang langsung disimpan.",
      path: ["teksPostingan"],
    }
  );

export const updateMentionSchema = z.object({
  status: z.nativeEnum(MentionStatus).optional(),
  topik: z.string().max(100).optional(),
  sentimen: z.nativeEnum(Sentiment).optional(),
  prioritas: z.nativeEnum(Priority).optional(),
  headline: z
    .string()
    .max(100, "Panjang headline maksimal 100 karakter.")
    .optional(),
  ringkasan: z
    .string()
    .max(400, "Panjang ringkasan maksimal 400 karakter.")
    .optional(),
  teksPostingan: z
    .string()
    .max(5000, "Teks postingan melebihi batas (maksimal 5000 karakter).")
    .optional(),
});

export const draftActionSchema = z.object({
  id: z.string().min(1, "ID draf wajib diisi."),
  action: z.enum(["approve", "reject"], {
    errorMap: () => ({ message: "Aksi harus 'approve' atau 'reject'." }),
  }),
  edits: z
    .object({
      topik: z.string().max(100).optional(),
      sentimen: z.nativeEnum(Sentiment).optional(),
      prioritas: z.nativeEnum(Priority).optional(),
      headline: z
        .string()
        .max(100, "Panjang headline maksimal 100 karakter.")
        .optional(),
      ringkasan: z
        .string()
        .max(400, "Panjang ringkasan maksimal 400 karakter.")
        .optional(),
      teksPostingan: z
        .string()
        .max(5000, "Teks postingan melebihi batas (maksimal 5000 karakter).")
        .optional(),
    })
    .optional(),
});

export const updateAlertSchema = z.object({
  id: z.string().min(1, "ID alert wajib diisi."),
});

export const saveTopicSchema = z.object({
  id: z.string().optional(),
  nama: z
    .string({ required_error: "Nama topik wajib diisi." })
    .min(1, "Nama topik tidak boleh kosong.")
    .max(100, "Nama topik maksimal 100 karakter."),
  kataKunci: z.array(z.string().max(50)).max(50).optional(),
  aktif: z.boolean().optional(),
});

export const saveThresholdsSchema = z.object({
  volumeThreshold: z.number().int().min(1).max(1000).optional(),
  volumeMultiplier: z.number().min(1.0).max(10.0).optional(),
  negativeThreshold: z.number().int().min(1).max(500).optional(),
  negativePercentage: z.number().min(1).max(100).optional(),
});

export const sampleDataSchema = z.object({
  action: z.enum(["seed", "clear"], {
    errorMap: () => ({
      message: "Aksi data contoh harus 'seed' atau 'clear'.",
    }),
  }),
});

export const importBatchSchema = z
  .array(
    z.object({
      url: z.string().min(1, "Tautan item impor tidak boleh kosong."),
      text: z.string().max(5000).optional(),
    })
  )
  .max(
    50,
    "Jumlah item impor melebihi batas (maksimal 50 item per transaksi)."
  );
