import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getSetting, setSetting } from '../db/repo'
import type { AiCall } from './orchestrate'
import { buildUserMessage, SYSTEM_PROMPT, type CoachContext } from './prompt'
import { aiSelectionSchema } from './validate'

// Claude API from the browser. Private single-user app: the key is pasted in Settings, stored only
// on this device (never exported), and sent only to api.anthropic.com.

export const DEFAULT_MODEL = 'claude-opus-5'
export const MODELS: { id: string; label: string; note: string }[] = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Default. About 2–4 US cents per check-in.' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Cheaper, about 1–2 cents per check-in.' },
]

export interface AiSettings {
  apiKey?: string
  model: string
}

export async function getAiSettings(): Promise<AiSettings> {
  return {
    apiKey: (await getSetting<string>('apiKey')) || undefined,
    model: (await getSetting<string>('aiModel')) || DEFAULT_MODEL,
  }
}

export async function saveAiSettings(s: Partial<AiSettings>): Promise<void> {
  if (s.apiKey !== undefined) await setSetting('apiKey', s.apiKey.trim())
  if (s.model !== undefined) await setSetting('aiModel', s.model)
}

function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 30_000 })
}

/** One selection call. Returns the parsed JSON (validated separately) or throws on API errors. */
export function selectionCall(settings: Required<AiSettings>, ctx: CoachContext): AiCall {
  return async (feedback?: string) => {
    const res = await client(settings.apiKey).messages.parse({
      model: settings.model,
      max_tokens: 8000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserMessage(ctx, feedback) }],
      output_config: { format: zodOutputFormat(aiSelectionSchema), effort: 'low' },
    })
    if (res.stop_reason === 'refusal') throw new Error('The model declined this request')
    if (res.stop_reason === 'max_tokens') throw new Error('The answer was cut off')
    return res.parsed_output
  }
}

/** Settings → "Test connection". Returns a short, user-facing message. */
export async function testConnection(settings: AiSettings): Promise<{ ok: boolean; message: string }> {
  if (!settings.apiKey) return { ok: false, message: 'Paste an API key first.' }
  try {
    await client(settings.apiKey).messages.create({
      model: settings.model,
      max_tokens: 64,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    })
    return { ok: true, message: 'Connected. The coach will explain and tailor your sessions.' }
  } catch (e) {
    return { ok: false, message: describeError(e) }
  }
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The API key was not accepted. Check that you copied all of it.'
  if (e instanceof Anthropic.PermissionDeniedError) return 'This key has no access to that model.'
  if (e instanceof Anthropic.NotFoundError) return 'Model not found. Pick another model in Settings.'
  if (e instanceof Anthropic.RateLimitError) return 'Too many requests right now. Try again in a minute.'
  if (e instanceof Anthropic.APIConnectionError) return 'No connection to the coach. The app works offline with the engine alone.'
  if (e instanceof Anthropic.APIError) return `The coach service returned an error (${e.status}).`
  return e instanceof Error ? e.message : String(e)
}
