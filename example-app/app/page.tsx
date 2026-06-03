'use client'

import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'

type PanelId = 'r1' | 'r2' | 'r3' | 'r4'
type PaneContent =
  | { kind: 'empty'; text: string }
  | { kind: 'iframe'; src: string; srcDoc?: never }
  | { kind: 'srcdoc'; srcDoc: string; src?: never }
  | { kind: 'pre'; text: string }

interface PanelState {
  status: 'idle' | 'running' | 'ok' | 'error'
  label: string
  meta: string
  content: PaneContent
}

const initialPanels: Record<PanelId, PanelState> = {
  r1: { status: 'idle', label: 'output', meta: 'idle', content: { kind: 'empty', text: 'Press a button to render.' } },
  r2: { status: 'idle', label: 'output', meta: 'idle', content: { kind: 'empty', text: 'Store a document to begin.' } },
  r3: { status: 'idle', label: 'output', meta: 'idle', content: { kind: 'empty', text: 'Press the button to stream a PDF to disk.' } },
  r4: { status: 'idle', label: 'output', meta: 'idle', content: { kind: 'empty', text: 'Press the button to see the error payload.' } },
}

const prettyJson = (raw: string): string => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export default function DemoPage(): JSX.Element {
  const [docId, setDocId] = useState<string | null>(null)
  const [panels, setPanels] = useState<Record<PanelId, PanelState>>(initialPanels)
  const [loading, setLoading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const setPanel = useCallback((id: PanelId, state: PanelState) => {
    setPanels(prev => ({ ...prev, [id]: state }))
  }, [])

  const runAction = useCallback(
    async (action: string, panelId: PanelId, needsDoc: boolean, fn: (set: (s: PanelState) => void) => Promise<void>) => {
      if (needsDoc && docId === null) return
      setLoading(action)
      setPanel(panelId, {
        status: 'running',
        label: 'output',
        meta: 'running…',
        content: { kind: 'empty', text: 'Working…' },
      })
      try {
        await fn(state => setPanel(panelId, state))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setPanel(panelId, {
          status: 'error',
          label: 'output',
          meta: 'error',
          content: { kind: 'pre', text: msg },
        })
      } finally {
        setLoading(null)
      }
    },
    [docId, setPanel],
  )

  const renderPdfLike = useCallback(async (url: string, panelLabel: string, panelId: PanelId): Promise<void> => {
    await runAction(`pdf-${panelLabel}`, panelId, false, async set => {
      const r = await fetch(url)
      if (!r.ok) {
        set({ status: 'error', label: 'output', meta: `HTTP ${r.status}`, content: { kind: 'pre', text: await r.text() } })
        return
      }
      const blob = await r.blob()
      set({
        status: 'ok',
        label: panelLabel,
        meta: `${blob.size.toLocaleString()} bytes`,
        content: { kind: 'iframe', src: URL.createObjectURL(blob) },
      })
    })
  }, [runAction])

  const onRenderPdf = useCallback(() => renderPdfLike('/render/pdf', 'pdf', 'r1'), [renderPdfLike])
  const onRenderStream = useCallback(() => renderPdfLike('/render/stream', 'pdf (stream)', 'r1'), [renderPdfLike])

  const onRenderPreview = useCallback(() => {
    return runAction('preview', 'r1', false, async set => {
      const r = await fetch('/render/preview')
      const html = await r.text()
      if (!r.ok) {
        set({ status: 'error', label: 'output', meta: `HTTP ${r.status}`, content: { kind: 'pre', text: html } })
        return
      }
      set({
        status: 'ok',
        label: 'html preview',
        meta: `${html.length.toLocaleString()} chars`,
        content: { kind: 'srcdoc', srcDoc: html },
      })
    })
  }, [runAction])

  const onDocCreate = useCallback(() => {
    return runAction('doc-create', 'r2', false, async set => {
      const r = await fetch('/documents', { method: 'POST' })
      const body = await r.text()
      const ok = r.ok
      set({
        status: ok ? 'ok' : 'error',
        label: 'document descriptor',
        meta: `${r.status} ${ok ? 'ok' : 'error'}`,
        content: { kind: 'pre', text: prettyJson(body) },
      })
      if (ok) {
        try { setDocId(JSON.parse(body).documentId as string) } catch { /* ignore */ }
      }
    })
  }, [runAction])

  const onDocGet = useCallback(() => {
    return runAction('doc-get', 'r2', true, async set => {
      // Why: /documents/{id} returns a 302 to a presigned S3 URL on a
      // different origin. fetch() with redirect:'follow' produces an
      // opaque cross-origin response and the body is unreadable. Iframe
      // navigation isn't a fetch — the browser follows the 302 natively.
      set({
        status: 'ok',
        label: 'stored pdf',
        meta: 'served via 302 → presigned S3 URL',
        content: { kind: 'iframe', src: `/documents/${docId}` },
      })
    })
  }, [docId, runAction])

  const onDocPreview = useCallback(() => {
    return runAction('doc-preview', 'r2', true, async set => {
      const r = await fetch(`/documents/${docId}/preview`)
      const html = await r.text()
      if (!r.ok) {
        set({ status: 'error', label: 'output', meta: `HTTP ${r.status}`, content: { kind: 'pre', text: html } })
        return
      }
      set({
        status: 'ok',
        label: 'stored html preview',
        meta: `${html.length.toLocaleString()} chars`,
        content: { kind: 'srcdoc', srcDoc: html },
      })
    })
  }, [docId, runAction])

  const onDocThumbnails = useCallback(() => {
    return runAction('doc-thumbnails', 'r2', true, async set => {
      const r = await fetch(`/documents/${docId}/thumbnails`)
      const body = await r.text()
      set({
        status: r.ok ? 'ok' : 'error',
        label: 'thumbnails',
        meta: `${r.status} ${r.ok ? 'ok' : 'error'}`,
        content: { kind: 'pre', text: prettyJson(body) },
      })
    })
  }, [docId, runAction])

  const onDocDelete = useCallback(() => {
    return runAction('doc-delete', 'r2', true, async set => {
      const r = await fetch(`/documents/${docId}`, { method: 'DELETE' })
      const body = await r.text()
      set({
        status: r.ok ? 'ok' : 'error',
        label: 'delete',
        meta: `${r.status} ${r.ok ? 'ok' : 'error'}`,
        content: { kind: 'pre', text: body || '"(204 No Content)"' },
      })
      if (r.ok) setDocId(null)
    })
  }, [docId, runAction])

  const onRenderFile = useCallback(() => {
    return runAction('render-file', 'r3', false, async set => {
      const r = await fetch('/render/file', { method: 'POST' })
      const body = await r.text()
      set({
        status: r.ok ? 'ok' : 'error',
        label: 'wrote to disk',
        meta: `${r.status} ${r.ok ? 'ok' : 'error'}`,
        content: { kind: 'pre', text: prettyJson(body) },
      })
    })
  }, [runAction])

  const onBadVersion = useCallback(() => {
    return runAction('bad-version', 'r4', false, async set => {
      const r = await fetch('/errors/bad-version')
      const body = await r.text()
      set({
        status: r.ok ? 'ok' : 'error',
        label: 'error payload',
        meta: `${r.status} ${r.ok ? 'ok' : 'error'}`,
        content: { kind: 'pre', text: prettyJson(body) },
      })
    })
  }, [runAction])

  const copy = useCallback(async (text: string, slot: string) => {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text)
      setCopied(slot)
      setTimeout(() => setCopied(prev => (prev === slot ? null : prev)), 1200)
    }
  }, [])

  return (
    <>
      <style>{CSS}</style>
      <div className="page">
        <header className="mast">
          <h1 className="wordmark">Welcome to <span className="brand">Poli&nbsp;Page</span></h1>
          <p className="tagline">Your Next.js integration, your dashboard. Every SDK feature, one click away.</p>
          <div className="status-row">
            <span className="dot"></span>
            <span>api-develop.poli.page</span>
            <span className="sep">·</span>
            <span>poli-page/nextjs v0.1.0</span>
          </div>
        </header>

        <Section
          title="Render"
          label="01 · instant"
          desc={<>Three SDK entry points for rendering the <code>getting-started/welcome</code> template: binary PDF (<code>render.pdf</code>), streamed PDF (<code>render.pdfStream</code>), and HTML preview (<code>render.preview</code>).</>}
        >
          <div className="actions">
            <ActionButton action="pdf" loading={loading} onClick={onRenderPdf}>Render PDF</ActionButton>
            <ActionButton action="pdf-pdf (stream)" loading={loading} onClick={onRenderStream}>Via stream</ActionButton>
            <ActionButton action="preview" loading={loading} onClick={onRenderPreview}>HTML preview</ActionButton>
          </div>
          <ResultPane state={panels.r1} />
        </Section>

        <Section
          title="Documents"
          label="02 · store & retrieve"
          desc={<>Persist a render (<code>render.document</code>), then fetch it back, preview it, list thumbnails, or soft-delete it. The four right-hand buttons unlock after a document exists.</>}
        >
          <DocIdBadge docId={docId} onCopy={() => docId !== null && copy(docId, `docid`)} copied={copied === 'docid'} />
          <div className="actions">
            <ActionButton action="doc-create" loading={loading} onClick={onDocCreate}>Store new document</ActionButton>
            <ActionButton action="doc-get" loading={loading} onClick={onDocGet} disabled={docId === null}>Get PDF</ActionButton>
            <ActionButton action="doc-preview" loading={loading} onClick={onDocPreview} disabled={docId === null}>Preview</ActionButton>
            <ActionButton action="doc-thumbnails" loading={loading} onClick={onDocThumbnails} disabled={docId === null}>Thumbnails</ActionButton>
            <ActionButton action="doc-delete" loading={loading} onClick={onDocDelete} disabled={docId === null}>Delete</ActionButton>
          </div>
          <ResultPane state={panels.r2} />
        </Section>

        <Section
          title="Filesystem"
          label="03 · render to disk"
          desc={<>The SDK&apos;s <code>renderToFile()</code> helper (from <code>@poli-page/sdk/node</code>) streams the PDF straight to disk under <code>example-app/output/welcome.pdf</code> — memory-bounded regardless of size.</>}
        >
          <div className="actions">
            <ActionButton action="render-file" loading={loading} onClick={onRenderFile}>Render to file</ActionButton>
          </div>
          <ResultPane state={panels.r3} />
        </Section>

        <Section
          title="Error handling"
          label="04 · typed exceptions"
          desc={<>Sends a deliberately malformed version string to trigger <code>INVALID_VERSION_FORMAT</code>. The integration&apos;s typed error mapping propagates the API code, message, and request-id straight through.</>}
        >
          <div className="actions">
            <ActionButton action="bad-version" loading={loading} onClick={onBadVersion}>Trigger 400</ActionButton>
          </div>
          <ResultPane state={panels.r4} />
        </Section>

        <Section
          title="Command line"
          label="05 · CLI"
          desc={<>The integration ships one standalone Node script for offline rendering, plus the standard HTTP smoke. Copy and run alongside this server.</>}
        >
          <CliBlock cmd="npm run render-to-file" slot="cli-1" copied={copied === 'cli-1'} onCopy={() => copy('npm run render-to-file', 'cli-1')} />
          <CliBlock cmd="curl -o /tmp/welcome.pdf http://localhost:3000/render/pdf" slot="cli-2" copied={copied === 'cli-2'} onCopy={() => copy('curl -o /tmp/welcome.pdf http://localhost:3000/render/pdf', 'cli-2')} />
        </Section>

        <footer>
          <span>poli-page/nextjs · v0.1.0</span>
          <span className="links"><a href="https://docs.poli.page" target="_blank" rel="noopener noreferrer">docs.poli.page</a></span>
        </footer>
      </div>
    </>
  )
}

function Section({ title, label, desc, children }: { title: string; label: string; desc: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <section>
      <div className="head">
        <h2>{title} <span className="label">{label}</span></h2>
        <p className="desc">{desc}</p>
      </div>
      {children}
    </section>
  )
}

function ActionButton({ action, loading, onClick, disabled, children }: { action: string; loading: string | null; onClick: () => void; disabled?: boolean; children: ReactNode }): JSX.Element {
  const isLoading = loading === action
  const isDisabled = (disabled === true || (loading !== null && !isLoading))
  return (
    <button
      type="button"
      className={`run${isLoading ? ' is-loading' : ''}`}
      onClick={onClick}
      disabled={isDisabled || isLoading}
    >
      {children}
    </button>
  )
}

function ResultPane({ state }: { state: PanelState }): JSX.Element {
  const cls = state.status === 'ok' ? 'result is-ok' : state.status === 'error' ? 'result is-error' : 'result'
  return (
    <div className={cls}>
      <div className="pane-label"><span>{state.label}</span><span className="meta">{state.meta}</span></div>
      <PaneBody content={state.content} />
    </div>
  )
}

function PaneBody({ content }: { content: PaneContent }): JSX.Element {
  switch (content.kind) {
    case 'empty':
      return <div className="empty">{content.text}</div>
    case 'iframe':
      return <iframe src={content.src} title="render output" />
    case 'srcdoc':
      return <iframe srcDoc={content.srcDoc} title="render output" />
    case 'pre':
      return <pre>{content.text}</pre>
  }
}

function DocIdBadge({ docId, onCopy, copied }: { docId: string | null; onCopy: () => void; copied: boolean }): JSX.Element {
  if (docId === null) {
    return (
      <div className="doc-id">
        <span className="indicator"></span>
        <span>no document stored</span>
      </div>
    )
  }
  return (
    <div className="doc-id has-id">
      <span className="indicator"></span>
      <span>documentId: {docId}</span>
      <button type="button" className={`copy${copied ? ' copied' : ''}`} onClick={onCopy}>
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  )
}

function CliBlock({ cmd, slot, copied, onCopy }: { cmd: string; slot: string; copied: boolean; onCopy: () => void }): JSX.Element {
  return (
    <div className="cli">
      <button type="button" className={`copy${copied ? ' copied' : ''}`} onClick={onCopy} data-slot={slot}>
        {copied ? 'copied' : 'Copy'}
      </button>
      <span className="prompt">$</span>{cmd}
    </div>
  )
}

const CSS = `
:root {
  --bg: #ffffff;
  --surface: #f7f8fb;
  --surface-deep: #eef0f6;
  --ink: #1a1d2e;
  --ink-soft: #5e6577;
  --ink-faint: #9aa0b0;
  --hairline: #e5e7ef;
  --hairline-strong: #cdd1dd;
  --brand: #4f5d99;
  --brand-deep: #3d4a7d;
  --brand-soft: rgba(79, 93, 153, 0.08);
  --brand-glow: rgba(79, 93, 153, 0.18);
  --red: #c8472b;
  --green: #3d8a3d;
  --gutter: clamp(1.25rem, 4vw, 4.5rem);
  --radius: 6px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { background: var(--bg); }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-weight: 400;
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  min-height: 100vh;
}

.page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 4rem var(--gutter) 6rem;
}

header.mast {
  text-align: center;
  margin-bottom: 4.5rem;
  padding-bottom: 3rem;
  border-bottom: 1px solid var(--hairline);
}
.wordmark {
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
  font-size: clamp(2.5rem, 5.5vw, 3.75rem);
  line-height: 1.05;
  letter-spacing: -0.025em;
  color: var(--ink);
}
.wordmark .brand { color: var(--brand); }
.tagline {
  font-family: 'IBM Plex Sans', sans-serif;
  font-style: italic;
  font-weight: 400;
  font-size: 1.05rem;
  color: var(--ink-soft);
  margin-top: 0.75rem;
}
.status-row {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.5rem;
  padding: 0.4rem 0.85rem;
  background: var(--brand-soft);
  border: 1px solid var(--brand-glow);
  border-radius: 100px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: var(--brand-deep);
  letter-spacing: 0.01em;
}
.status-row .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 3px rgba(79, 93, 153, 0.22);
  animation: pulse 2.4s ease-in-out infinite;
  flex-shrink: 0;
}
.status-row .sep { color: var(--ink-faint); }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(79, 93, 153, 0.22); }
  50%      { box-shadow: 0 0 0 6px rgba(79, 93, 153, 0.04); }
}

section {
  padding: 3rem 0;
  border-top: 1px solid var(--hairline);
  opacity: 0;
  animation: rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}
section:nth-of-type(1) { animation-delay: 0.05s; border-top: none; padding-top: 0; }
section:nth-of-type(2) { animation-delay: 0.12s; }
section:nth-of-type(3) { animation-delay: 0.19s; }
section:nth-of-type(4) { animation-delay: 0.26s; }
section:nth-of-type(5) { animation-delay: 0.33s; }
@keyframes rise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

section .head { margin-bottom: 1.5rem; }
section h2 {
  font-family: 'Manrope', sans-serif;
  font-weight: 700;
  font-size: 1.6rem;
  letter-spacing: -0.018em;
  line-height: 1.2;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
}
section h2 .label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--brand);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--brand-soft);
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  line-height: 1;
  align-self: center;
}
section .desc {
  font-family: 'IBM Plex Sans', sans-serif;
  font-style: italic;
  color: var(--ink-soft);
  font-size: 0.98rem;
  max-width: 64ch;
  margin-top: 0.4rem;
}
section .desc code {
  font-family: 'JetBrains Mono', monospace;
  font-style: normal;
  font-size: 0.82em;
  background: var(--surface);
  border: 1px solid var(--hairline);
  padding: 0.05em 0.4em;
  border-radius: 3px;
  color: var(--ink);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 1.5rem;
}
button.run {
  font-family: 'Manrope', sans-serif;
  font-weight: 600;
  font-size: 0.84rem;
  letter-spacing: -0.005em;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius);
  padding: 0.6rem 1rem 0.6rem 0.85rem;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.2, 0.7, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
button.run::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--brand);
  flex-shrink: 0;
  transition: transform 0.18s, background 0.18s;
}
button.run:hover:not(:disabled) {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-deep);
  transform: translateY(-1px);
}
button.run:hover:not(:disabled)::before { transform: scale(1.35); }
button.run:active:not(:disabled) { transform: translateY(0); }
button.run:disabled {
  border-color: var(--hairline);
  color: var(--ink-faint);
  cursor: not-allowed;
  background: var(--surface);
}
button.run:disabled::before { background: var(--ink-faint); }
button.run.is-loading {
  border-color: var(--brand);
  background: var(--brand);
  color: white;
  cursor: progress;
}
button.run.is-loading::before {
  background: white;
  animation: pulse-dot 0.9s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.4); }
}

.result {
  border: 1px solid var(--hairline);
  background: var(--surface);
  border-radius: var(--radius);
  min-height: 4rem;
  position: relative;
  overflow: hidden;
}
.result .pane-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.85rem;
  background: var(--bg);
  border-bottom: 1px solid var(--hairline);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}
.result .pane-label .meta {
  color: var(--ink-soft);
  text-transform: none;
  letter-spacing: 0;
}
.result.is-ok .pane-label { color: var(--brand); border-bottom-color: var(--brand-glow); }
.result.is-ok .pane-label .meta { color: var(--brand-deep); }
.result.is-error .pane-label { color: var(--red); border-bottom-color: rgba(200, 71, 43, 0.3); }
.result.is-error .pane-label .meta { color: var(--red); }

.result .empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ink-faint);
  font-style: italic;
  font-size: 0.95rem;
}
.result iframe {
  display: block;
  width: 100%;
  height: 600px;
  border: 0;
  background: white;
}
.result pre {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  line-height: 1.6;
  padding: 1.1rem 1rem;
  overflow-x: auto;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-all;
  background: white;
}
.result.is-error pre { color: var(--red); background: rgba(200, 71, 43, 0.04); }

.doc-id {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  padding: 0.45rem 0.8rem;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  margin-bottom: 1rem;
  color: var(--ink-faint);
  transition: all 0.2s;
}
.doc-id.has-id { color: var(--ink); border-color: var(--brand-glow); background: var(--brand-soft); }
.doc-id .indicator {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--ink-faint);
}
.doc-id.has-id .indicator { background: var(--brand); box-shadow: 0 0 0 3px rgba(79, 93, 153, 0.18); }
.doc-id button.copy {
  background: none;
  border: none;
  color: var(--brand-deep);
  font-family: inherit;
  font-size: 0.85em;
  cursor: pointer;
  padding: 0 0 0 0.3rem;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
  text-decoration-color: var(--brand-glow);
}
.doc-id button.copy:hover { color: var(--ink); text-decoration-color: var(--brand); }

.cli {
  border: 1px solid var(--hairline-strong);
  background: #161827;
  color: #d6d9e6;
  padding: 1rem 1.1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  line-height: 1.7;
  margin-bottom: 0.75rem;
  border-radius: var(--radius);
  position: relative;
  overflow-x: auto;
}
.cli .prompt { color: #8b96d4; user-select: none; margin-right: 0.5rem; }
.cli button.copy {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  background: transparent;
  border: 1px solid #2d3148;
  color: #8b96d4;
  font-family: inherit;
  font-size: 0.7rem;
  padding: 0.25rem 0.55rem;
  border-radius: 3px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: all 0.15s;
}
.cli button.copy:hover { background: #1f2236; color: white; border-color: var(--brand); }
.cli button.copy.copied { color: #b8c3ff; border-color: var(--brand); }

footer {
  margin-top: 5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--hairline);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: var(--ink-faint);
  letter-spacing: 0.04em;
}
footer .links a {
  color: var(--brand-deep);
  text-decoration: none;
  border-bottom: 1px solid var(--brand-glow);
  transition: border-color 0.15s;
}
footer .links a:hover { border-bottom-color: var(--brand); }

@media (max-width: 720px) {
  .actions { flex-direction: column; align-items: stretch; }
  button.run { justify-content: center; }
  section h2 { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
}
`
