import { onMount, onCleanup, type Component } from "solid-js";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from "chart.js";
import { formatCurrency } from "../../lib/format";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export interface BarChartDataset {
  label: string;
  data: number[];
  color: string;
}

interface BarChartProps {
  labels: string[];
  datasets: BarChartDataset[];
  class?: string;
}

export const BarChart: Component<BarChartProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined;
  let chart: Chart | null = null;

  onMount(() => {
    if (!canvas) return;
    const cfg: ChartConfiguration = {
      type: "bar",
      data: {
        labels: props.labels,
        datasets: props.datasets.map((ds) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.color,
          borderRadius: 6,
          borderSkipped: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: {
              color: "var(--color-muted)",
              font: { family: "var(--font-body)", size: 12 },
              boxWidth: 12,
              boxHeight: 12,
              borderRadius: 3,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: "var(--color-border)" },
            ticks: { color: "var(--color-muted)", font: { family: "var(--font-body)", size: 11 } },
            border: { color: "var(--color-border)" },
          },
          y: {
            grid: { color: "var(--color-border)" },
            ticks: {
              color: "var(--color-muted)",
              font: { family: "var(--font-body)", size: 11 },
              callback: (value) => formatCurrency(Number(value)),
            },
            border: { color: "var(--color-border)" },
          },
        },
      },
    };
    chart = new Chart(canvas, cfg);
  });

  onCleanup(() => {
    chart?.destroy();
    chart = null;
  });

  return (
    <div class={props.class ?? "relative h-64"}>
      <canvas ref={canvas} />
    </div>
  );
};
