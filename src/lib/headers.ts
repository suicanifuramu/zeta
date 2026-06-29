import { getDeviceId } from "@/lib/auth"

export const APP_VERSION = "0.0.1"
export const CLIENT_TYPE = "app"
export const DEVICE_TYPE = "android"
export const SENTRY_PUBLIC_KEY = "fd83742acfe641a1888315dbc022c936"

const LANG_MAP: Record<string, string> = {
  ja: "JAPANESE",
  "ja-JP": "JAPANESE",
  en: "ENGLISH",
  "en-US": "ENGLISH",
  ko: "KOREAN",
}

export function getUserLanguage(): string {
  return LANG_MAP[navigator.language] || "ENGLISH"
}

let currentTraceId = ""
let currentTransaction = "Splash"
let sampleRand = 0

function generateTraceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function generateSpanId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function startSentryTransaction(name: string) {
  currentTraceId = generateTraceId()
  currentTransaction = name
  sampleRand = Math.random()
}

export function getSentryTraceHeaders() {
  if (!currentTraceId) startSentryTransaction("Splash")

  const traceId = currentTraceId
  const spanId = generateSpanId()
  const sampled = "0"
  const release = `zeta-chat@${APP_VERSION}-web`

  const baggage =
    `sentry-environment=production,` +
    `sentry-release=${release},` +
    `sentry-public_key=${SENTRY_PUBLIC_KEY},` +
    `sentry-trace_id=${traceId},` +
    `sentry-transaction=${currentTransaction},` +
    `sentry-sampled=${sampled},` +
    `sentry-sample_rand=${sampleRand},` +
    `sentry-sample_rate=0.001`

  return {
    "sentry-trace": `${traceId}-${spanId}-${sampled}`,
    baggage,
  }
}

export function getCommonHeaders() {
  return {
    accept: "application/json, text/plain, */*",
    "x-client-version": APP_VERSION,
    "x-client-native-version": APP_VERSION,
    "x-client-type": CLIENT_TYPE,
    "x-device-type": DEVICE_TYPE,
    "x-user-language": getUserLanguage(),
    "x-sticky": getDeviceId(),
    ...getSentryTraceHeaders(),
  }
}
