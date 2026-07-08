import { useEffect, useRef } from "react";
import { Chart, ChartConfiguration } from "chart.js/auto";

interface DebtProgressChartProps {
  data: number[];
  labels: string[];
  className?: string;
  enableVariation?: boolean; // Only for demo/mock data
  freezeLast?: boolean; // Preserve real last value (default true)
}

export function DebtProgressChart({ data, labels, className = "", enableVariation = false, freezeLast = true }: DebtProgressChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // Add realistic financial fluctuations while maintaining overall downward trend
  const addRealisticVariation = (originalData: number[], seed: string) => {
    if (!enableVariation) return originalData;
    
    // Simple seeded random function for deterministic results
    const seededRandom = (seedStr: string, index: number) => {
      const hash = (seedStr + index).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return (Math.abs(hash) % 1000) / 1000;
    };
    
    const variedData = [...originalData];
    const totalPoints = originalData.length;
    const startValue = originalData[0];
    const endValue = originalData[originalData.length - 1];
    const totalReduction = startValue - endValue;
    
    // Create more dramatic ups and downs while maintaining overall trend
    for (let index = 1; index < totalPoints - 1; index++) {
      // Calculate expected position on the overall trend line
      const progress = index / (totalPoints - 1);
      const trendValue = startValue - (totalReduction * progress);
      
      // Add significant fluctuations (up to ±20% from trend)
      const random1 = seededRandom(seed, index);
      const random2 = seededRandom(seed, index + 100); // Different seed for more variation
      
      // Create wave-like patterns with multiple frequency components
      const wave1 = Math.sin(progress * Math.PI * 3) * 0.15; // 3 cycles
      const wave2 = Math.sin(progress * Math.PI * 7 + random1 * 2 * Math.PI) * 0.08; // 7 cycles, phase shifted
      const noise = (random2 - 0.5) * 0.12; // Random noise
      
      const totalVariation = (wave1 + wave2 + noise);
      const variationAmount = trendValue * totalVariation;
      
      variedData[index] = Math.max(trendValue + variationAmount, 0);
    }
    
    // Ensure the overall trend is still downward by applying a smoothing constraint
    // Allow some points to go up from previous, but not too much
    for (let index = 1; index < totalPoints - 1; index++) {
      const prevValue = variedData[index - 1];
      const currentValue = variedData[index];
      
      // Allow increases up to 8% from previous point occasionally
      const maxIncrease = prevValue * 1.08;
      if (currentValue > maxIncrease) {
        variedData[index] = maxIncrease;
      }
      
      // But ensure we don't go above the starting trend too much
      const progress = index / (totalPoints - 1);
      const maxAllowed = startValue - (totalReduction * progress * 0.6); // More lenient constraint
      if (variedData[index] > maxAllowed) {
        variedData[index] = maxAllowed;
      }
    }
    
    // Always preserve the last value if freezeLast is true
    if (freezeLast) {
      variedData[variedData.length - 1] = originalData[originalData.length - 1];
    }
    
    return variedData;
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Use canvas height for proper gradient scaling
    const canvasHeight = canvasRef.current.height || 400;
    
    // Create seed from labels for deterministic variation
    const seed = labels.join('-');
    const variedData = addRealisticVariation(data, seed);

    // Create gradient for the line using actual canvas height
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'hsl(271, 81%, 66%)');
    gradient.addColorStop(0.5, 'hsl(271, 81%, 56%)');
    gradient.addColorStop(1, 'hsl(271, 81%, 46%)');

    // Create gradient for the fill area using actual canvas height
    const fillGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    fillGradient.addColorStop(0, 'hsl(271, 81%, 66%, 0.2)');
    fillGradient.addColorStop(0.7, 'hsl(271, 81%, 66%, 0.1)');
    fillGradient.addColorStop(1, 'hsl(271, 81%, 66%, 0.05)');

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Debt',
          data: variedData,
          borderColor: gradient,
          backgroundColor: fillGradient,
          borderWidth: 3,
          tension: 0.3,
          cubicInterpolationMode: 'monotone',
          fill: true,
          pointBackgroundColor: 'hsl(271, 81%, 66%)',
          pointBorderColor: '#fff',
          pointBorderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointHoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Total Debt: $${context.parsed.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: 'hsl(215, 16%, 47%)'
            }
          },
          y: {
            beginAtZero: false,
            grid: {
              color: 'hsl(210, 40%, 95%)'
            },
            ticks: {
              color: 'hsl(215, 16%, 47%)',
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, labels, enableVariation, freezeLast]);

  return (
    <div className={`relative min-w-0 w-full max-w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
