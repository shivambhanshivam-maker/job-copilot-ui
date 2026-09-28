import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import {
  ApiService,
  ApplicationVelocity,
  ChannelEffectiveness,
  FunnelConversion,
  PerformanceMetrics,
  StatusPipeline
} from '../services/api.service';

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  count: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss'
})
export class AnalyticsComponent implements OnInit {
  loading = true;
  loadingFunnel = false;

  funnelData: FunnelConversion | null = null;
  velocityData: ApplicationVelocity | null = null;
  pipelineData: StatusPipeline | null = null;
  performanceData: PerformanceMetrics | null = null;
  channelData: ChannelEffectiveness | null = null;

  funnelFilterTabs: string[] = [];
  selectedFunnelCategory = 'All';

  // SVG chart
  velocityPath = '';
  velocityViewBox = '0 0 600 200';
  chartPoints: ChartPoint[] = [];
  yTicks: { value: number; y: number }[] = [];
  chartBottom = 160;
  chartLeft = 45;
  chartRight = 580;

  constructor(private apiService: ApiService) {}

  get analyticsSummaryTitle(): string {
    const recent = this.performanceData?.responseRateLast30Days;
    const allTime = this.performanceData?.responseRate;

    if (recent != null && allTime != null) {
      const differenceInPoints = Math.round((recent - allTime) * 100);
      if (differenceInPoints >= 5) return 'Recruiter response is improving';
      if (differenceInPoints <= -5) return 'Recent applications are getting fewer responses';
      return 'Recruiter response is holding steady';
    }

    if ((this.funnelData?.interviews ?? 0) > 0) return 'Your application funnel is producing interviews';
    return 'Your search baseline is taking shape';
  }

  get analyticsSummaryText(): string {
    const recent = this.performanceData?.responseRateLast30Days;
    const allTime = this.performanceData?.responseRate;

    if (recent != null && allTime != null) {
      const points = Math.round(Math.abs(recent - allTime) * 100);
      if (points === 0) return 'Your recent response rate is in line with your overall search performance.';
      const direction = recent > allTime ? 'above' : 'below';
      return `Your recent response rate is ${points} percentage points ${direction} your all-time rate.`;
    }

    const applications = this.pipelineTotal;
    if (applications > 0) {
      return `${applications} tracked applications are building the evidence needed for stronger comparisons.`;
    }
    return 'Track applications and recruiter updates to build a reliable view of your search.';
  }

  ngOnInit(): void {
    forkJoin({
      funnel: this.apiService.getFunnelConversion(),
      velocity: this.apiService.getApplicationVelocity(),
      pipeline: this.apiService.getStatusPipeline(),
      performance: this.apiService.getPerformanceMetrics(),
      channel: this.apiService.getChannelEffectiveness(),
      funnelFilters: this.apiService.getFunnelFilters()
    }).subscribe({
      next: ({ funnel, velocity, pipeline, performance, channel, funnelFilters }) => {
        this.funnelData = funnel;
        this.velocityData = velocity;
        this.pipelineData = pipeline;
        this.performanceData = performance;
        this.channelData = channel;
        this.funnelFilterTabs = funnelFilters.length > 1 ? funnelFilters : [];
        this.buildVelocityChart();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onFunnelFilterChange(category: string): void {
    if (category === this.selectedFunnelCategory) return;
    this.selectedFunnelCategory = category;
    this.loadingFunnel = true;
    this.apiService.getFunnelConversion(category).subscribe({
      next: (funnel) => {
        this.funnelData = funnel;
        this.loadingFunnel = false;
      },
      error: () => { this.loadingFunnel = false; }
    });
  }

  private buildVelocityChart(): void {
    const weeks = this.velocityData?.weeks;
    if (!weeks?.length) return;

    const n = weeks.length;
    const W = 600, H = 200;
    const padL = 45, padR = 20, padT = 25, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const counts = weeks.map(w => w.count);
    const rawMin = Math.min(...counts);
    const rawMax = Math.max(...counts);
    const yMin = Math.max(0, Math.floor(rawMin * 0.8));
    const yMax = Math.ceil(rawMax * 1.15) || 1;
    const yRange = yMax - yMin;

    this.yTicks = Array.from({ length: 5 }, (_, i) => {
      const value = Math.round(yMin + (yRange / 4) * i);
      const y = padT + chartH - ((value - yMin) / yRange) * chartH;
      return { value, y };
    });

    this.chartBottom = H - padB;
    this.chartLeft = padL;
    this.chartRight = W - padR;
    this.velocityViewBox = `0 0 ${W} ${H}`;

    this.chartPoints = weeks.map((w, i) => ({
      x: padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW),
      y: padT + chartH - ((w.count - yMin) / yRange) * chartH,
      label: w.label,
      count: w.count
    }));

    let d = `M ${this.chartPoints[0].x.toFixed(1)} ${this.chartPoints[0].y.toFixed(1)}`;
    for (let i = 1; i < n; i++) {
      const prev = this.chartPoints[i - 1];
      const curr = this.chartPoints[i];
      const pp = this.chartPoints[Math.max(0, i - 2)];
      const nx = this.chartPoints[Math.min(n - 1, i + 1)];

      const cp1x = prev.x + (curr.x - pp.x) / 6;
      const cp1y = prev.y + (curr.y - pp.y) / 6;
      const cp2x = curr.x - (nx.x - prev.x) / 6;
      const cp2y = curr.y - (nx.y - prev.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }
    this.velocityPath = d;
  }

  get pipelineTotal(): number {
    if (!this.pipelineData) return 0;
    return this.pipelineData.applied + this.pipelineData.interview +
           this.pipelineData.offer + this.pipelineData.rejected;
  }

  pipelinePct(count: number): number {
    return this.pipelineTotal > 0 ? (count / this.pipelineTotal) * 100 : 0;
  }

  get velocityEmpty(): boolean {
    return !this.velocityData?.weeks.length ||
           this.velocityData.weeks.every(w => w.count === 0);
  }

  get benchmarkValue(): number {
    return this.channelData?.industryBenchmark ?? this.channelData?.benchmarkMultiplier ?? 0;
  }

}
