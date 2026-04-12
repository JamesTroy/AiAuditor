'use client';

import { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// Area chart of score over last N audits.
export function ScoreTrendChart({ scores }: { scores: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: scores.map((_, i) => i + 1),
        datasets: [
          {
            data: scores,
            borderColor: '#7c3aed',
            backgroundColor: isDark ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.07)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#7c3aed',
            pointRadius: scores.map((_, i) => (i === scores.length - 1 ? 4 : 0)),
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Score: ${ctx.parsed.y}/100`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { display: false },
            border: { display: false },
          },
          y: {
            min: Math.max(0, Math.min(...scores) - 10),
            max: 100,
            grid: {
              color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            },
            border: { display: false },
            ticks: {
              color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              font: { size: 10 },
              stepSize: 10,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [scores]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '160px' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Line chart of audit scores over last ${scores.length} audits. Scores: ${scores.join(', ')}.`}
      >
        Audit scores over last {scores.length} audits: {scores.join(', ')}.
      </canvas>
    </div>
  );
}
