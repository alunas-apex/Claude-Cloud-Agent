'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useHealth(pollInterval = 10000) {
  const [data, setData] = useState<{ status: string; version: string; uptime: number; channels: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.health();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, pollInterval);
    return () => clearInterval(timer);
  }, [refresh, pollInterval]);

  return { data, error, refresh };
}

export function useSessions(pollInterval = 5000) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api.sessions.list();
      setSessions(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, pollInterval);
    return () => clearInterval(timer);
  }, [refresh, pollInterval]);

  return { sessions, error, loading, refresh };
}

export function useToolExecutions(pollInterval = 5000) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api.tools.executions();
      setExecutions(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load executions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, pollInterval);
    return () => clearInterval(timer);
  }, [refresh, pollInterval]);

  return { executions, error, loading, refresh };
}

export function useTodayCost(pollInterval = 10000) {
  const [cost, setCost] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.cost.today();
        setCost(result.costUsd);
      } catch {}
    };
    load();
    const timer = setInterval(load, pollInterval);
    return () => clearInterval(timer);
  }, [pollInterval]);

  return cost;
}

export function useCostBreakdown(pollInterval = 10000) {
  const [breakdown, setBreakdown] = useState<{
    byModel: Record<string, { tokensIn: number; tokensOut: number; costUsd: number; requests: number }>;
    total: { tokensIn: number; tokensOut: number; costUsd: number; requests: number };
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.cost.breakdown();
        setBreakdown(result);
      } catch {}
    };
    load();
    const timer = setInterval(load, pollInterval);
    return () => clearInterval(timer);
  }, [pollInterval]);

  return breakdown;
}

export function useBudgetStatus(pollInterval = 10000) {
  const [budget, setBudget] = useState<{
    dailyBudgetUsd: number; dailySpentUsd: number; dailyRemainingUsd: number;
    sessionBudgetUsd: number; sessionSpentUsd: number; sessionRemainingUsd: number;
    isOverBudget: boolean; autoDowngrade: boolean;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.budget.status();
        setBudget(result);
      } catch {}
    };
    load();
    const timer = setInterval(load, pollInterval);
    return () => clearInterval(timer);
  }, [pollInterval]);

  return budget;
}

export function useSettings() {
  const [settings, setSettings] = useState<{ key: string; value: string; updatedAt: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api.settings.getAll();
      setSettings(result);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const updateSetting = useCallback(async (key: string, value: string) => {
    await api.settings.update(key, value);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { settings, loading, refresh, updateSetting };
}
