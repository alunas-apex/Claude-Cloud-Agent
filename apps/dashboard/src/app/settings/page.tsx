export default function SettingsPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
      <p className="text-[var(--muted)] text-sm mb-8">Configure agent behavior, models, and integrations</p>

      <div className="space-y-6 max-w-2xl">
        {/* Model Configuration */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Model Configuration</h3>
          <div className="space-y-4">
            <SettingRow label="Default Model" value="claude-sonnet-4-6" />
            <SettingRow label="Complex Task Model" value="claude-opus-4-6" />
            <SettingRow label="Simple Task Model" value="claude-haiku-4-5" />
            <SettingRow label="Auto-Routing" value="Enabled" />
          </div>
        </section>

        {/* Budget & Limits */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Budget & Limits</h3>
          <div className="space-y-4">
            <SettingRow label="Daily Budget" value="$10.00" />
            <SettingRow label="Per-Session Limit" value="$2.00" />
            <SettingRow label="Max Tool Iterations" value="10" />
            <SettingRow label="History Limit" value="20 messages" />
          </div>
        </section>

        {/* API Keys */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">API Keys</h3>
          <div className="space-y-4">
            <SettingRow label="Anthropic API Key" value="sk-ant-...configured" />
            <SettingRow label="Google OAuth" value="Configured (2 accounts)" />
            <SettingRow label="Twilio" value="Configured" />
          </div>
        </section>

        {/* Channels */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Messaging Channels</h3>
          <div className="space-y-4">
            <ChannelToggle name="Twilio SMS" enabled={true} />
            <ChannelToggle name="Web Chat" enabled={true} />
            <ChannelToggle name="Telegram" enabled={false} />
            <ChannelToggle name="Slack" enabled={false} />
            <ChannelToggle name="WhatsApp" enabled={false} />
            <ChannelToggle name="Discord" enabled={false} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-sm text-gray-300">{value}</span>
    </div>
  );
}

function ChannelToggle({ name, enabled }: { name: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">{name}</span>
      <span className={`text-xs px-2 py-1 rounded ${enabled ? 'bg-green-900/30 text-green-400' : 'bg-white/5 text-[var(--muted)]'}`}>
        {enabled ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
}
