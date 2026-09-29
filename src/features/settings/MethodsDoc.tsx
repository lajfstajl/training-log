import type { ReactNode } from 'react'
import doc from '../../../docs/coaching-methods.md?raw'
import { back } from '../../router'
import { Header } from '../../ui'

// A small Markdown renderer for our own doc: headings, paragraphs, lists, tables, bold, italics, code, links.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k++} className="rounded bg-surface-2 px-1 text-sm">{t.slice(1, -1)}</code>)
    else if (t.startsWith('[')) {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!
      out.push(<a key={k++} href={href} target="_blank" rel="noreferrer" className="text-target underline">{label}</a>)
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function render(md: string): ReactNode[] {
  const lines = md.split(/\r?\n/)
  const out: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.trim() === '') { i++; continue }
    const h = /^(#{1,4})\s+(.*)/.exec(l)
    if (h) {
      const size = ['text-2xl', 'text-xl', 'text-lg', 'text-base'][h[1].length - 1]
      out.push(<p key={i} className={`${size} mt-6 mb-2 font-bold`}>{inline(h[2])}</p>)
      i++
      continue
    }
    if (l.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s:-]+\|/.test(lines[i])) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()))
        i++
      }
      out.push(
        <div key={i} className="my-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr>{rows[0].map((c, j) => <th key={j} className="border-b border-line p-1.5 align-top">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border-b border-line p-1.5 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*[-*]\s/.test(l)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s/, ''))
      out.push(<ul key={i} className="my-2 list-disc pl-5">{items.map((t, j) => <li key={j} className="my-0.5">{inline(t)}</li>)}</ul>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(#|\||\s*[-*]\s)/.test(lines[i])) para.push(lines[i++])
    out.push(<p key={i} className="my-2">{inline(para.join(' '))}</p>)
  }
  return out
}

export function MethodsDoc() {
  return (
    <div>
      <Header title="Coaching methods" onBack={() => back('/settings')} />
      <article className="px-4 pb-8 leading-relaxed">{render(doc)}</article>
    </div>
  )
}
