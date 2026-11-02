import { useEffect, useState } from 'react'

// Public research record (provenance hashes + milestone plan) loaded from /public/research/<file>.json
// Team members with consent:false are shown by role only.
export default function ProjectRecord({ src }) {
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(src).then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(setD).catch(e => setErr(String(e)))
  }, [src])

  const box = { background: '#16213e', border: '1px solid #0f3460' }
  const cell = { color: '#ddd', borderColor: '#333', fontSize: '0.8rem', verticalAlign: 'top' }
  const head = { ...cell, color: '#00d1b2' }
  if (err) return <div className="box mb-4" style={box}><p className="has-text-danger is-size-7">Record not loaded: {err}</p></div>
  if (!d) return null
  const p = d.project
  const who = c => { const m = d.team.find(t => t.name && t.name.includes(c)); return m && !m.consent ? m.role.split(' - ')[0] : c }

  return (
    <div className="box mb-4" style={box}>
      <div className="is-flex is-justify-content-space-between is-align-items-start">
        <div>
          <p className="has-text-grey-light is-size-7">Research record · {p.code}</p>
          <h2 className="subtitle has-text-white mb-2">📄 {p.title}</h2>
          <p className="has-text-grey is-size-7">{p.lineage}</p>
        </div>
        <span className="tag is-info is-light">{p.status}</span>
      </div>
      <p className="has-text-grey-lighter is-size-7 mt-3">{p.abstract}</p>

      <button className="button is-small is-outlined mt-3" style={{ borderColor: '#00d1b2', color: '#00d1b2' }} onClick={() => setOpen(!open)}>
        {open ? '▲ Hide record' : '▼ Team, provenance and milestones'}
      </button>

      {open && (
        <div className="mt-4">
          <p className="has-text-white has-text-weight-bold is-size-6 mb-2">Team</p>
          <ul className="mb-4">
            {d.team.map((t, i) => (
              <li key={i} className="is-size-7 has-text-grey-lighter">
                {t.consent ? <b className="has-text-white">{t.name}</b> : <i>Co-investigator (listing pending confirmation)</i>}
                {t.consent ? ` · ${t.affiliation} · ` : ' · '}{t.role}
              </li>
            ))}
          </ul>

          <p className="has-text-white has-text-weight-bold is-size-6 mb-2">Provenance (SHA-256 of dated source documents)</p>
          <div className="table-container mb-4">
            <table className="table is-narrow is-fullwidth" style={{ background: 'transparent' }}>
              <thead><tr><th style={head}>Date</th><th style={head}>Contribution</th><th style={head}>By</th><th style={head}>SHA-256</th></tr></thead>
              <tbody>{d.provenance.map((r, i) => (
                <tr key={i}>
                  <td style={cell}>{r.date}</td><td style={cell}>{r.event}</td><td style={cell}>{who(r.contributor)}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', wordBreak: 'break-all', minWidth: 160 }} title={r.sha256}>{r.sha256.slice(0, 16)}…</td>
                </tr>))}
              </tbody>
            </table>
          </div>

          <p className="has-text-white has-text-weight-bold is-size-6 mb-2">Milestone plan</p>
          {d.milestones.map(m => (
            <div key={m.id} className="box mb-2" style={{ background: '#0f3460', padding: '0.6rem 0.8rem' }}>
              <p className="has-text-white is-size-7 has-text-weight-bold">
                M{m.id} · {m.title} <span className="has-text-grey">({m.basis})</span>
                {m.conditional && <span className="tag is-warning is-light is-small ml-2">conditional</span>}
              </p>
              <p className="has-text-grey-lighter is-size-7">{m.deliverable}</p>
              <p className="has-text-success is-size-7">Acceptance: {m.acceptance}</p>
            </div>
          ))}

          <p className="has-text-grey is-size-7 mt-3">{d.confidentialityNote} {p.testnetNotice} Updated {d.updated}.</p>
        </div>
      )}
    </div>
  )
}
