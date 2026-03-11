import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboardBundle } from "../ui/api.js";

export function useDashboardData(year) {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const [seasons, setSeasons] = useState(null);
  const [efficiency, setEfficiency] = useState(null);
  const [outliers, setOutliers] = useState(null);
  const [socWindowAnalysis, setSocWindowAnalysis] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRequestRef = useRef(0);
  const hasDataRef = useRef(false);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    const hasData = hasDataRef.current;

    setLoading(!hasData);
    setRefreshing(hasData);
    setErr(null);

    try {
      const bundle = await getDashboardBundle(year);

      if (requestId !== refreshRequestRef.current) return;

      setStats(bundle?.stats ?? null);
      setSessions(Array.isArray(bundle?.sessions?.rows) ? bundle.sessions.rows : []);
      setMonthly(bundle?.monthly ?? null);
      setSeasons(bundle?.seasons ?? null);
      setEfficiency(bundle?.efficiency ?? null);
      setOutliers(bundle?.outliers ?? null);
      setSocWindowAnalysis(bundle?.soc_window_analysis ?? null);
      setIntelligence(bundle?.intelligence ?? null);
      setAvailableYears(Array.isArray(bundle?.available_years) ? bundle.available_years : []);
      hasDataRef.current = true;
    } catch (error) {
      if (requestId !== refreshRequestRef.current) return;
      setErr(String(error?.message || error));
    } finally {
      if (requestId === refreshRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [year]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    efficiency,
    err,
    availableYears,
    intelligence,
    loading,
    monthly,
    outliers,
    refreshing,
    refresh,
    seasons,
    sessions,
    socWindowAnalysis,
    stats,
  };
}
