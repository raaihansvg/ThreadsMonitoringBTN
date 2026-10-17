"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Card1TrendVolume } from "@/components/dashboard/Card1TrendVolume";
import { Card2PositiveSentiment } from "@/components/dashboard/Card2PositiveSentiment";
import { Card3NeedsAttention } from "@/components/dashboard/Card3NeedsAttention";
import { Card4SentimentByTopic } from "@/components/dashboard/Card4SentimentByTopic";
import { Card5TopTopicFocus } from "@/components/dashboard/Card5TopTopicFocus";
import { Card6DailyIndex7Days } from "@/components/dashboard/Card6DailyIndex7Days";
import { Card7WeeklySummaryQuickInput } from "@/components/dashboard/Card7WeeklySummaryQuickInput";

interface DashboardData {
  totalMentions: number;
  prevCount: number;
  growthText: string;
  isGrowthPositive: boolean;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  positivePercentage: string;
  negativePercentage: string;
  needsAttentionCount: number;
  dailyThreshold: number;
  isWeeklyAggregation: boolean;
  trendBars: Array<{
    label: string;
    count: number;
    isSpike: boolean;
    isPeak: boolean;
  }>;
  topicsBreakdown: Array<{
    nama: string;
    count: number;
    percentage: number;
    positif: number;
    netral: number;
    negatif: number;
  }>;
  topTopic: {
    nama: string;
    count: number;
    percentage: number;
  };
  daily7Days: Array<{
    dayLabel: string;
    dateLabel: string;
    count: number;
    isSpike: boolean;
  }>;
  draftsCount: number;
  unreadAlertsCount: number;
  weeklySummary: {
    headline: string;
    summary: string;
  };
}

export default function DashboardPage() {
  const {
    dateRange,
    selectedTopic,
    showSampleData,
    refreshTrigger,
    granularity,
  } = useApp();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [topicsList, setTopicsList] = useState<string[]>([]);

  useEffect(() => {
    // Ambil daftar topik aktif untuk filter Card 1
    fetch("/api/topics")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && Array.isArray(json.topics)) {
          setTopicsList(json.topics.map((t: { nama: string }) => t.nama));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      topic: selectedTopic,
      includeSample: String(showSampleData),
      granularity,
    });

    fetch(`/api/dashboard?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Gagal mengambil data dashboard:", err);
        setLoading(false);
      });
  }, [dateRange, selectedTopic, showSampleData, refreshTrigger, granularity]);

  if (loading || !data) {
    return (
      <div className="grid animate-pulse grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="h-96 rounded-[28px] bg-slate-200/60 lg:col-span-7" />
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="h-44 rounded-[28px] bg-slate-200/60" />
          <div className="h-44 rounded-[28px] bg-slate-200/60" />
        </div>
        <div className="h-96 rounded-[28px] bg-slate-200/60 lg:col-span-3" />
        <div className="h-72 rounded-[28px] bg-slate-200/60 lg:col-span-4" />
        <div className="h-72 rounded-[28px] bg-slate-200/60 lg:col-span-3" />
        <div className="h-72 rounded-[28px] bg-slate-200/60 lg:col-span-5" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* BARIS 1 */}
      {/* Kartu 1: Tren Volume Mention (7 Kolom) */}
      <div className="flex flex-col lg:col-span-7">
        <Card1TrendVolume
          totalMentions={data.totalMentions}
          growthText={data.growthText}
          isGrowthPositive={data.isGrowthPositive}
          negativeCount={data.negativeCount}
          negativePercentage={data.negativePercentage}
          dailyThreshold={data.dailyThreshold}
          isWeeklyAggregation={data.isWeeklyAggregation}
          trendBars={data.trendBars}
          topicsList={topicsList}
        />
      </div>

      {/* Kartu 2 & Kartu 3: Sentimen Positif & Perlu Perhatian (2 Kolom) */}
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Card2PositiveSentiment
          positivePercentage={data.positivePercentage}
          positiveCount={data.positiveCount}
          neutralCount={data.neutralCount}
          negativeCount={data.negativeCount}
        />
        <Card3NeedsAttention needsAttentionCount={data.needsAttentionCount} />
      </div>

      {/* Kartu 4: Sentimen per Topik dan Antrean (3 Kolom) */}
      <div className="flex flex-col lg:col-span-3">
        <Card4SentimentByTopic
          totalMentions={data.totalMentions}
          topicsBreakdown={data.topicsBreakdown}
          draftsCount={data.draftsCount}
          unreadAlertsCount={data.unreadAlertsCount}
        />
      </div>

      {/* BARIS 2 */}
      {/* Kartu 5: Fokus Topik Teratas (4 Kolom) */}
      <div className="flex flex-col lg:col-span-4">
        <Card5TopTopicFocus topTopic={data.topTopic} />
      </div>

      {/* Kartu 6: Indeks Harian 7 Hari Terakhir (3 Kolom) */}
      <div className="flex flex-col lg:col-span-3">
        <Card6DailyIndex7Days
          daily7Days={data.daily7Days}
          dailyThreshold={data.dailyThreshold}
        />
      </div>

      {/* Kartu 7: Ringkasan Mingguan dan Input Cepat (5 Kolom) */}
      <div className="flex flex-col lg:col-span-5">
        <Card7WeeklySummaryQuickInput weeklySummary={data.weeklySummary} />
      </div>
    </div>
  );
}
