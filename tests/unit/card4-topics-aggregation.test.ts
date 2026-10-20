import { describe, it, expect } from "vitest";
import { aggregateTopicsForCard4, TopicStat } from "@/components/dashboard/Card4SentimentByTopic";

describe("Card 4 Dashboard Topics Aggregation", () => {
  it("Menghasilkan hanya satu baris 'Lainnya' ketika 'Lainnya' ada di input breakdown", () => {
    // Skenario akar masalah:
    // Input memiliki 'Lainnya' di top 3, dan juga memiliki topik urutan ke-4 dan ke-5.
    // Kode lama memotong slice(0, 3) yang menyertakan 'Lainnya', lalu push 'Lainnya' kedua dari sisa topik.
    const input: TopicStat[] = [
      { nama: "BTN Mobile", count: 10, percentage: 33.3, positif: 5, netral: 3, negatif: 2 },
      { nama: "Lainnya", count: 8, percentage: 26.7, positif: 2, netral: 4, negatif: 2 },
      { nama: "KPR BTN", count: 6, percentage: 20.0, positif: 3, netral: 2, negatif: 1 },
      { nama: "Tabungan BTN", count: 4, percentage: 13.3, positif: 2, netral: 1, negatif: 1 },
      { nama: "Tapera", count: 2, percentage: 6.7, positif: 1, netral: 1, negatif: 0 },
    ];
    const totalMentions = 30;

    const result = aggregateTopicsForCard4(input, totalMentions);

    // 1. Pastikan entri 'Lainnya' tepat 1
    const lainnyaItems = result.filter((item) => item.nama.toLowerCase() === "lainnya");
    expect(lainnyaItems.length).toBe(1);

    // 2. Pastikan hitungan 'Lainnya' adalah gabungan (8 dari input awal + 2 Tapera dari sisa = 10)
    expect(lainnyaItems[0].count).toBe(10);

    // 3. Pastikan key unik (tidak ada nama yang berulang)
    const names = result.map((item) => item.nama);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);

    // 4. Pastikan jumlah seluruh baris sama persis dengan totalMentions
    const sumCount = result.reduce((acc, curr) => acc + curr.count, 0);
    expect(sumCount).toBe(totalMentions);
  });

  it("Menggabungkan topik dengan nama duplikat dan menjumlahkan hitungannya", () => {
    const input: TopicStat[] = [
      { nama: "BTN Mobile", count: 5, percentage: 25, positif: 2, netral: 2, negatif: 1 },
      { nama: "BTN Mobile", count: 7, percentage: 35, positif: 4, netral: 2, negatif: 1 },
      { nama: "KPR BTN", count: 8, percentage: 40, positif: 4, netral: 3, negatif: 1 },
    ];
    const totalMentions = 20;

    const result = aggregateTopicsForCard4(input, totalMentions);

    // BTN Mobile harus digabung menjadi 12
    const btnMobile = result.find((t) => t.nama === "BTN Mobile");
    expect(btnMobile).toBeDefined();
    expect(btnMobile?.count).toBe(12);

    const names = result.map((item) => item.nama);
    expect(new Set(names).size).toBe(names.length);

    const sumCount = result.reduce((acc, curr) => acc + curr.count, 0);
    expect(sumCount).toBe(totalMentions);
  });

  it("Menangani selisih data bila totalMentions melebihi jumlah breakdown ke dalam 'Lainnya'", () => {
    const input: TopicStat[] = [
      { nama: "KPR BTN", count: 5, percentage: 50, positif: 3, netral: 1, negatif: 1 },
    ];
    const totalMentions = 10; // Ada 5 mention yang belum memiliki topik terdata

    const result = aggregateTopicsForCard4(input, totalMentions);

    const sumCount = result.reduce((acc, curr) => acc + curr.count, 0);
    expect(sumCount).toBe(totalMentions);

    const lainnya = result.find((t) => t.nama === "Lainnya");
    expect(lainnya?.count).toBe(5);
  });
});
