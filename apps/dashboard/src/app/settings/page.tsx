'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSettings, useHealth } from '../../hooks/use-api';

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
];

const ALL_CHANNELS = ['twilio', 'webchat', 'telegram', 'slack', 'whatsapp', 'discord'];

const DEFAULTS: Record<string, string> = {
  'model.default': 'claude-sonnet-4-6',
  'model.complex': 'claude-opus-4-6',
  'model.simple': 'claude-haiku-4-5',
  'model.autoRouting': 'true',
  'budget.daily': '10',
  'budget.perSession': '2',
  'budget.maxToolIterations': '10',
  'budget.historyLimit': '20',
};

const API_SERVICES = [
  { key: 'anthropic', label: 'Anthropic API Key' },
  { key: 'google', label: 'Google OAuth' },
  { key: 'twilio', label: 'Twilio' },
  { key: 'telegram', label: 'Telegram Bot' },
  { key: 'slack', label: 'Slack' },
  { key: 'zoom', label: 'Zoom' },
];

function SavedIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="text-xs text-green-400 ml-2 animate-pulse">Saved</span>
  );
}

export default function SettingsPage() {
  const { settings, loading, updateSetting } = useSettings();
  const { data: health, error: healthError } = useHealth();
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const getSetting = useCallback(
    (key: string): string => {
      const found = settings.find((s) => s.key === key);
      return found ? found.value : (DEFAULTS[key] ?? '');
    },
    [settings]
  );

  const handleSave = useCallback(
    async (key: string, value: string) => {
      try {
        await updateSetting(key, value);
        setSavedKeys((prev) => new Set(prev).add(key));
        setTimeout(() => {
          setSavedKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 2000);
      } catch {
        // error is already surfaced by the hook
      }
    },
    [updateSetting]
  );

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
        <p className="text-[var(--muted)] text-sm">Loading settings...</p>
      </div>
    );
  }

  const activeChannels = health?.channels ?? [];

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
      <p className="text-[var(--muted)] text-sm mb-8">
        Configure agent behavior, models, and integrations
      </p>

      <div className="space-y-6 max-w-2xl">
        {/* ── Model Configuration ── */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Model Configuration
          </h3>
          <div className="space-y-4">
            <ModelSelect
              label="Default Model"
              settingKey="model.default"
              value={getSetting('model.default')}
              saved={savedKeys.has('model.default')}
              onSave={handleSave}
            />
            <ModelSelect
              label="Complex Task Model"
              settingKey="model.complex"
              value={getSetting('model.complex')}
              saved={savedKeys.has('model.complex')}
              onSave={handleSave}
            />
            <ModelSelect
              label="Simple Task Model"
              settingKey="model.simple"
              value={getSetting('model.simple')}
              saved={savedKeys.has('model.simple')}
              onSave={handleSave}
            />
            <ToggleRow
              label="Auto-Routing"
              settingKey="model.autoRouting"
              value={getSetting('model.autoRouting') === 'true'}
              saved={savedKeys.has('model.autoRouting')}
              onSave={handleSave}
            />
          </div>
        </section>

        {/* ── Budget & Limits ── */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Budget & Limits
          </h3>
          <div className="space-y-4">
            <NumberInput
              label="Daily Budget"
              settingKey="budget.daily"
              value={getSetting('budget.daily')}
              saved={savedKeys.has('budget.daily')}
              onSave={handleSave}
              prefix="$"
            />
            <NumberInput
              label="Per-Session Limit"
              settingKey="budget.perSession"
              value={getSetting('budget.perSession')}
              saved={savedKeys.has('budget.perSession')}
              onSave={handleSave}
              prefix="$"
            />
            <NumberInput
              label="Max Tool Iterations"
              settingKey="budget.maxToolIterations"
              value={getSetting('budget.maxToolIterations')}
              saved={savedKeys.has('budget.maxToolIterations')}
              onSave={handleSave}
            />
            <NumberInput
              label="History Limit"
              settingKey="budget.historyLimit"
              value={getSetting('budget.historyLimit')}
              saved={savedKeys.has('budget.historyLimit')}
              onSave={handleSave}
              suffix="messages"
            />
          </div>
        </section>

        {/* ── API Keys ── */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">API Keys</h3>
          {healthError && (
            <p className="text-xs text-red-400 mb-3">
              Could not fetch service status: {healthError}
            </p>
          )}
          <div className="space-y-4">
            {API_SERVICES.map((svc) => {
              const configured = activeChannels.some(
                (ch) => ch.toLowerCase() === svc.key.toLowerCase()
              );
              return (
                <div
                  key={svc.key}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-[var(--muted)]">
                    {svc.label}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      configured
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-white/5 text-[var(--muted)]'
                    }`}
                  >
                    {configured ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Messaging Channels ── */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Messaging Channels
          </h3>
          <div className="space-y-4">
            {ALL_CHANNELS.map((ch) => {
              const isActive = activeChannels.some(
                (a) => a.toLowerCase() === ch.toLowerCase()
              );
              return (
                <ChannelToggle key={ch} name={ch} enabled={isActive} />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function ModelSelect({
  label,
  settingKey,
  value,
  saved,
  onSave,
}: {
  label: string;
  settingKey: string;
  value: string;
  saved: boolean;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--muted)] whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <select
          value={value}
          onChange={(e) => onSave(settingKey, e.target.value)}
          className="bg-[var(--card-border)] text-sm text-gray-200 rounded px-3 py-1.5 border border-[var(--card-border)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <SavedIndicator visible={saved} />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  settingKey,
  value,
  saved,
  onSave,
}: {
  label: string;
  settingKey: string;
  value: boolean;
  saved: boolean;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onSave(settingKey, value ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            value ? 'bg-[var(--accent)]' : 'bg-[var(--card-border)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-xs text-gray-400 w-7">
          {value ? 'On' : 'Off'}
        </span>
        <SavedIndicator visible={saved} />
      </div>
    </div>
  );
}

function NumberInput({
  label,
  settingKey,
  value,
  saved,
  onSave,
  prefix,
  suffix,
}: {
  label: string;
  settingKey: string;
  value: string;
  saved: boolean;
  onSave: (key: string, value: string) => Promise<void>;
  prefix?: string;
  suffix?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = () => {
    if (local !== value && local.trim() !== '') {
      onSave(settingKey, local);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--muted)] whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {prefix && (
          <span className="text-sm text-gray-400">{prefix}</span>
        )}
        <input
          type="number"
          min={0}
          step="any"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="bg-[var(--card-border)] text-sm text-gray-200 rounded px-3 py-1.5 w-24 border border-[var(--card-border)] focus:outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="text-xs text-gray-400">{suffix}</span>
        )}
        <SavedIndicator visible={saved} />
      </div>
    </div>
  );
}

function ChannelToggle({ name, enabled }: { name: string; enabled: boolean }) {
  const [toggled, setToggled] = useState(enabled);

  useEffect(() => {
    setToggled(enabled);
  }, [enabled]);

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-300">{displayName}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            toggled
              ? 'bg-green-900/30 text-green-400'
              : 'bg-white/5 text-[var(--muted)]'
          }`}
        >
          {toggled ? 'Active' : 'Inactive'}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={toggled}
        onClick={() => setToggled(!toggled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          toggled ? 'bg-[var(--accent)]' : 'bg-[var(--card-border)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            toggled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
