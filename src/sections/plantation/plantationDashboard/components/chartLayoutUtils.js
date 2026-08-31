import { useEffect, useState } from 'react';

const MOBILE_BP = 640;

export function usePlantationChartLayout() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BP : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return {
    isMobile,
    height: isMobile ? 288 : 400,
    margin: isMobile
      ? { top: 4, right: 8, left: 0, bottom: 0 }
      : { top: 20, right: 30, left: 20, bottom: 20 },
    barCategoryGap: isMobile ? '18%' : '20%',
    barGap: isMobile ? 2 : 4,
    maxBarSize: isMobile ? 32 : 56,
    xAxis: {
      tick: { fontSize: isMobile ? 10 : 12 },
      interval: isMobile ? 0 : 'preserveStartEnd',
      angle: isMobile ? -35 : 0,
      textAnchor: isMobile ? 'end' : 'middle',
      height: isMobile ? 52 : 30,
    },
    yAxis: {
      width: isMobile ? 40 : 60,
      tick: { fontSize: isMobile ? 10 : 12 },
      label: isMobile
        ? undefined
        : { value: 'Hectares (Ha)', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } },
    },
  };
}
