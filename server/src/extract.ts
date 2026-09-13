// Field extraction for inbound vendor dispatch emails, with OCR built in.
//
// Gemini reads inline images and PDFs natively as part of the same call that
// extracts fields — there's no separate "OCR step": a photographed or
// scanned dispatch sheet attachment is just another part of the prompt. When
// no API key is configured, or the Gemini call fails for any reason (rate
// limit, bad response, network), this always falls back to the regex-based
// parser in parser.ts so an order is never lost — see extractOrder().
import { parseServiceOrderEmail, type ParsedOrder } from './parser.ts'

export interface EmailAttachmentInput {
  filename: string
  mimeType: string
  /** base64-encoded content */
  data: string
}

export interface ExtractInput {
  fromHeader: string
  subject: string
  text: string
  attachments?: EmailAttachmentInput[]
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'

// Types Gemini can read directly (images + PDF as multimodal input).
const SUPPORTED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
])

// Keep the combined inline payload well under Gemini's ~20MB inline-data cap.
const MAX_INLINE_BYTES = 15 * 1024 * 1024

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    vendorName: { type: 'STRING' },
    vendorEmail: { type: 'STRING' },
    claimNumber: { type: 'STRING' },
    customerName: { type: 'STRING' },
    customerPhone: { type: 'STRING' },
    customerEmail: { type: 'STRING' },
    customerAddress: { type: 'STRING' },
    brand: { type: 'STRING' },
    model: { type: 'STRING' },
    serial: { type: 'STRING' },
    reportedProblem: { type: 'STRING' },
    appointmentPreference: { type: 'STRING' },
    authorizationLimit: { type: 'STRING' },
    repairRate: { type: 'STRING' },
    notes: { type: 'STRING' },
    needsReview: { type: 'BOOLEAN' },
    missingFields: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'vendorName',
    'vendorEmail',
    'claimNumber',
    'customerName',
    'customerPhone',
    'customerEmail',
    'customerAddress',
    'brand',
    'model',
    'serial',
    'reportedProblem',
    'appointmentPreference',
    'authorizationLimit',
    'repairRate',
    'notes',
    'needsReview',
    'missingFields',
  ],
}

const PROMPT_TEMPLATE = `You are extracting a structured HVAC/home-warranty service dispatch order from a vendor email. The email text below, and any attached images or PDFs (which may be photographed or scanned dispatch sheets), are your source of truth — read all of it, including attachments.

Return exactly one JSON object matching the response schema. Rules:
- If the text is a forwarded email, ignore the forwarding client's boilerplate ("---------- Forwarded message ---------", "Begin forwarded message:", "-----Original Message-----", etc.) and extract from the original vendor content inside it.
- vendorName / vendorEmail are the dispatching company and its contact address — not whoever forwarded the email.
- Leave a field as an empty string "" if it is genuinely not present anywhere in the text or attachments. Never invent a value.
- missingFields: the subset of [customerName, reportedProblem, customerAddress, claimNumber] that are empty/unknown.
- needsReview: true if missingFields is non-empty, false otherwise.

From: {{fromHeader}}
Subject: {{subject}}

Email body:
{{text}}`

function buildPrompt(input: ExtractInput): string {
  return PROMPT_TEMPLATE.replace('{{fromHeader}}', input.fromHeader)
    .replace('{{subject}}', input.subject)
    .replace('{{text}}', input.text.trim() || '(empty — see attachments)')
}

function isParsedOrderShape(v: unknown): v is ParsedOrder {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.customerName === 'string' && typeof o.needsReview === 'boolean' && Array.isArray(o.missingFields)
}

export async function extractWithGemini(
  input: ExtractInput,
  apiKey: string,
  model: string = DEFAULT_MODEL,
): Promise<ParsedOrder> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: buildPrompt(input) },
  ]

  let inlineBytes = 0
  for (const att of input.attachments ?? []) {
    if (!SUPPORTED_ATTACHMENT_TYPES.has(att.mimeType)) continue
    const approxBytes = (att.data.length * 3) / 4 // base64 -> raw size estimate
    if (inlineBytes + approxBytes > MAX_INLINE_BYTES) continue
    inlineBytes += approxBytes
    parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } })
  }

  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Gemini returned no content')

  const parsed = JSON.parse(raw)
  if (!isParsedOrderShape(parsed)) throw new Error('Gemini response did not match the expected order shape')
  return parsed
}

export interface ExtractResult {
  order: ParsedOrder
  method: 'gemini' | 'regex'
  error?: string
}

/** Extracts order fields, preferring Gemini (with OCR for attachments) and always
 * falling back to the regex parser so a flaky/unconfigured extractor never
 * drops an order. */
export async function extractOrder(input: ExtractInput, geminiApiKey?: string, model?: string): Promise<ExtractResult> {
  if (!geminiApiKey) return { order: parseServiceOrderEmail(input), method: 'regex' }

  try {
    const order = await extractWithGemini(input, geminiApiKey, model)
    return { order, method: 'gemini' }
  } catch (err) {
    return {
      order: parseServiceOrderEmail(input),
      method: 'regex',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
