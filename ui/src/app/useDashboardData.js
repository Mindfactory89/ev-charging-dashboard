import { useCallback, useEffect, useRef, useState } from "react";
import {
  ladeAuswertung,
  ladeLadevorgaenge,
  ladeMonatsauswertung,
  ladeSaisonauswertung,
  ladeEfficiencyScore,
  ladeAusreisserAnalyse,
} from "../ui/api.js";

export function useDashboardData(year) {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const [seasons, setSeasons] = useState(null);
  const [efficiency, setEfficiency] = useState(null);
  const [outliers, setOutliers] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    setLoading(true);
    setErr(null);
    setStats(null);
    setSessions([]);
    setMonthly(null);
    setSeasons(null);
    setEfficiency(null);
    setOutliers(null);

    try {
      const [statsData, sessionsData, monthlyData, seasonsData, efficiencyData, outlierData] = await Promise.all([
        ladeAuswertung(year),
        ladeLadevorgaenge(year),
        ladeMonatsauswertung(year),
        ladeSaisonauswertung(year),
        ladeEfficiencyScore(year),
        ladeAusreisserAnalyse(year),
      ]);

      if (requestId !== refreshRequestRef.current) return;

      setStats(statsData ?? null);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setMonthly(monthlyData ?? null);
      setSeasons(seasonsData ?? null);
      setEfficiency(efficiencyData ?? null);
      setOutliers(outlierData ?? null);
    } catch (error) {
      if (requestId !== refreshRequestRef.current) return;
      setErr(String(error?.message || error));
    } finally {
      if (requestId === refreshRequestRef.current) {
        setLoading(false);
      }
    }
  }, [year]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    efficiency,
    err,
    loading,
    monthly,
    outliers,
    refresh,
    seasons,
    sessions,
    stats,
  };
}
