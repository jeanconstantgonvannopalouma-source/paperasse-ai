import sharp from 'sharp'
import { ExtractedData } from '../../types/database'

const SYSTEM_PROMPT = `Tu es un expert comptable spécialisé BTP / artisans en France.
Analyse le document (facture, ticket, reçu, devis).
Réponds UNIQUEMENT avec un JSON valide (sans markdown) :
{
  "document_type": "supplier_invoice" | "customer_invoice" | "receipt" | "quote" | "other",
  "third_party_name": string|null,
  "invoice_number": string|null,
  "transaction_date": "YYYY-MM-DD"|null,
  "amount_ht": number|null,
  "amount_ttc": number|null,
  "vat_amount": number|null,
  "vat_rates": [{"rate": number, "base_ht": number, "vat_amount": number}],
  "is_autoliquidation": boolean,
  "payment_method": "cb"|"cash"|"transfer"|"cheque"|"unknown",
  "category": string|null,
  "chantier_hint": string|null,
  "confidence_score": number,
  "needs_review": boolean,
  "raw_notes": string|null
}`

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY manquante dans .env.local')
  return key
}

function safeJsonParse(content: string): any {
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned)
}

function normalizeExtracted(data: any): ExtractedData {
  const amount_ht = typeof data?.amount_ht === 'number' ? data.amount_ht : null
  const vat_amount = typeof data?.vat_amount === 'number' ? data.vat_amount : null
  let amount_ttc = typeof data?.amount_ttc === 'number' ? data.amount_ttc : null

  if (amount_ht != null && vat_amount != null && amount_ttc == null) {
    amount_ttc = Number((amount_ht + vat_amount).toFixed(2))
  }

  const allowedTypes = new Set(['supplier_invoice', 'customer_invoice', 'receipt', 'quote', 'other'])
  const score = typeof data?.confidence_score === 'number' ? data.confidence_score : 0.5

  return {
    document_type: allowedTypes.has(data?.document_type) ? data.document_type : 'other',
    third_party_name: data?.third_party_name || null,
    invoice_number: data?.invoice_number || null,
    transaction_date: data?.transaction_date || null,
    amount_ht,
    amount_ttc,
    vat_amount,
    vat_rates: Array.isArray(data?.vat_rates) ? data.vat_rates : [],
    is_autoliquidation: Boolean(data?.is_autoliquidation),
    payment_method: data?.payment_method || 'unknown',
    category: data?.category || null,
    chantier_hint: data?.chantier_hint || null,
    confidence_score: score,
    needs_review: typeof data?.needs_review === 'boolean' ? data.needs_review : score < 0.75,
    raw_notes: data?.raw_notes || null,
  }
}

async function optimizeImageBuffer(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.startsWith('image/')) return { buffer, mimeType }
  try {
    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer()
    console.log(`[OPTIMIZER] Image ${(buffer.length / 1024).toFixed(0)}KB -> ${(optimized.length / 1024).toFixed(0)}KB`)
    return { buffer: optimized, mimeType: 'image/jpeg' }
  } catch (err) {
    return { buffer, mimeType }
  }
}

async function listWorkingModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

async function callGemini(apiKey: string, model: string, prompt: string, base64: string, mimeType: string) {
  const cleanModel = model.replace(/^models\//, '')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' }
    })
  })
  const raw = await res.text()
  let json: any = null
  try { json = JSON.parse(raw) } catch {}
  if (!res.ok) {
    const err: any = new Error(json?.error?.message || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('')
  if (!text) throw new Error('Réponse vide')
  return text
}

export async function extractDocumentFromBuffer(rawBuffer: Buffer, rawMimeType: string, fileName?: string): Promise<ExtractedData> {
  const apiKey = getGeminiKey()
  const { buffer, mimeType } = await optimizeImageBuffer(rawBuffer, rawMimeType)
  const base64 = buffer.toString('base64')
  const cleanMime = mimeType.split(';')[0].trim() || 'image/jpeg'
  const prompt = `${SYSTEM_PROMPT}\n\nDocument: ${fileName || 'document'}`

  let models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
  const detected = await listWorkingModels(apiKey)
  if (detected.length > 0) {
    const flashes = detected.filter(m => /flash/i.test(m) && !/embed|tts|vision/i.test(m))
    models = Array.from(new Set([...flashes, ...detected, ...models]))
  }

  let lastError: any = null
  for (const model of models.slice(0, 5)) {
    try {
      console.log(`[AI-NATIVE] Analyse avec modèle Google: ${model}`)
      const rawResponse = await callGemini(apiKey, model, prompt, base64, cleanMime)
      const parsed = safeJsonParse(rawResponse)
      const normalized = normalizeExtracted(parsed)
      console.log(`[AI-SUCCESS] Succès avec ${model} -> Fournisseur: ${normalized.third_party_name}, Total TTC: ${normalized.amount_ttc}€`)
      return normalized
    } catch (err: any) {
      lastError = err
      console.warn(`[AI-RETRY] Modèle ${model} indisponible: ${err.message}`)
    }
  }
  throw new Error(`Analyse IA impossible: ${lastError?.message || 'Erreur réseau'}`)
}

// Fonction wrapper pour la rétro-compatibilité
export async function extractDocumentFromUrl(
  fileUrl: string,
  fileName?: string
): Promise<ExtractedData> {
  let absoluteUrl = fileUrl
  if (fileUrl.startsWith('/')) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    absoluteUrl = `${baseUrl}${fileUrl}`
  }

  const res = await fetch(absoluteUrl)
  if (!res.ok) {
    throw new Error(`Impossible de télécharger le fichier (${res.status} ${res.statusText})`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const contentType = res.headers.get('content-type') || 'image/jpeg'

  return extractDocumentFromBuffer(buffer, contentType, fileName)
}
