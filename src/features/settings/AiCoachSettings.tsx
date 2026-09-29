import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getAiSettings, MODELS, saveAiSettings, testConnection } from '../../coach/ai'
import { Button, Chip } from '../../ui'

/** API key (stored on this device only), model, and a connection test. */
export function AiCoachSettings() {
  const s = useLiveQuery(getAiSettings, [])
  const [key, setKey] = useState<string>()
  const [status, setStatus] = useState<{ ok: boolean; message: string }>()
  const [testing, setTesting] = useState(false)
  if (!s) return null
  const shown = key ?? s.apiKey ?? ''

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        With a Claude API key, the coach picks and explains your session from the engine’s options. Without one, the engine builds the session
        on its own. The numbers are the same either way.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">API key</span>
        <input
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          value={shown}
          onChange={(e) => setKey(e.target.value)}
          onBlur={() => key !== undefined && saveAiSettings({ apiKey: key })}
          className="h-12 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none"
        />
      </label>
      <p className="text-xs text-muted">
        Stored only on this device and never included in exports. Get a key at{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-target underline">
          console.anthropic.com
        </a>{' '}
        (API Keys → Create key). You pay Anthropic per use.
      </p>
      <div>
        <span className="mb-1.5 block text-sm text-muted">Model</span>
        <div className="flex flex-col gap-2">
          {MODELS.map((m) => (
            <Chip key={m.id} selected={s.model === m.id} onClick={() => saveAiSettings({ model: m.id })} className="text-left">
              <span className="block">{m.label}</span>
              <span className="block text-xs font-normal opacity-80">{m.note}</span>
            </Chip>
          ))}
        </div>
      </div>
      <Button
        disabled={testing || !shown}
        onClick={async () => {
          setTesting(true)
          if (key !== undefined) await saveAiSettings({ apiKey: key })
          setStatus(await testConnection({ ...s, apiKey: shown }))
          setTesting(false)
        }}
      >
        {testing ? 'Testing…' : 'Test connection'}
      </Button>
      {status && <p className={`text-sm ${status.ok ? 'text-good' : 'text-warn'}`}>{status.message}</p>}
    </div>
  )
}
