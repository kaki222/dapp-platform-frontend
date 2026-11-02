import { useEffect, useState } from 'react'

// Public research record (provenance hashes + milestone plan) loaded from /public/research/<file>.json
// Team members with consent:false are shown by role only.
export default function ProjectRecord({ src }) {
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')
  const [checks, setChecks] = useState([])

  useEffect(() => {
    fetch(src).then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(setD).catch(e => setErr(String(e)))
  }, [src])

  const box = { background: '#16213e', border: '1px solid #0f3460' }
  const cell = { color: '#ddd', borderColor: '#333', fontSize: '0.8rem', verticalAlign: 'top', textAlign: 'left' }
  const head = { ...cell, color: '#00d1b2' }
  const verify = async files => {
    const known = {}
    ;(d.provenance || []).forEach(r => { if (r.sha256) known[r.sha256] = `${r.date} · ${r.event}` })
    ;(d.archive || []).forEach(a => { known[a.sha256] = `email: ${a.file}` })
    ;(d.attachments || []).forEach(a => { known[a.sha256] = `attachment: ${a.file}` })
    const out = []
    for (const f of files) {
      const buf = await f.arrayBuffer()
      const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('')
      out.push({ name: f.name, hash: h, match: known[h] })
    }
    setChecks(out)
  }

  if (err) return <div className="box mb-4" style={box}><p className="has-text-danger is-size-7">Record not loaded: {err}</p></div>
  if (!d) return null
  const p = d.project
  const who = c => { const m = d.team.find(t => t.name && t.name.includes(c)); return m && !m.consent ? m.role.split(' - ')[0] : c }

  return (
    <div className="box mb-4" style={{ ...box, textAlign: 'left' }}>
      <div className="is-flex is-justify-content-space-between is-align-items-start">
        <div>
          <p className="has-text-grey-light is-size-7">Research record · {p.code}</p>
          <h2 className="subtitle has-text-white mb-2">📄 {p.title}</h2>
          <p className="has-text-grey is-size-7">{p.lineage}</p>
        </div>
        <span className="tag is-info is-light">{p.status}</span>
      </div>
      <p className="has-text-grey-lighter is-size-7 mt-3">{p.abstract}</p>
      {d.onchain && (
        <p className="is-size-7 mt-2">
          <span className="tag is-success is-light mr-2">On-chain</span>
          <span className="has-text-grey-light">Project #{d.onchain.projectId} on {d.onchain.network}, registered {d.onchain.registered} · </span>
          <a href={`https://sepolia.etherscan.io/address/${d.onchain.contract}`} target="_blank" rel="noreferrer" style={{ color: '#00d1b2' }}>ResearchCollaboration contract ↗</a>
        </p>
      )}

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
                  <td style={{ ...cell, fontFamily: 'monospace', wordBreak: 'break-all', minWidth: 160 }} title={r.sha256 || r.source}>{r.sha256 ? r.sha256.slice(0, 16) + '…' : 'see archive'}</td>
                </tr>))}
              </tbody>
            </table>
          </div>

          {d.archive && (<>
            <p className="has-text-white has-text-weight-bold is-size-6 mb-2">Email archive 2020-21 (SHA-256 of original .msg files)</p>
            <div className="table-container mb-4">
              <table className="table is-narrow is-fullwidth" style={{ background: 'transparent' }}>
                <tbody>{d.archive.map((a, i) => (
                  <tr key={i}><td style={{ ...cell, textAlign: 'left' }}>{a.file}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'left' }}>{a.sha256}</td></tr>))}
                </tbody>
              </table>
            </div>
          </>)}

          {d.attachments && (<>
            <p className="has-text-white has-text-weight-bold is-size-6 mb-2">Attachments (SHA-256 of original files)</p>
            <div className="table-container mb-4">
              <table className="table is-narrow is-fullwidth" style={{ background: 'transparent' }}>
                <tbody>{d.attachments.map((a, i) => (
                  <tr key={i}><td style={cell}>{a.file}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', wordBreak: 'break-all' }}>{a.sha256}</td></tr>))}
                </tbody>
              </table>
            </div>
          </>)}

          <p className="has-text-white has-text-weight-bold is-size-6 mb-2">Verify a file</p>
          <div className="mb-4" style={{ border: '1px dashed #00d1b2', borderRadius: 6, padding: '0.8rem' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); verify([...e.dataTransfer.files]) }}>
            <p className="has-text-grey-light is-size-7 mb-2">Drop original files here, or choose them. The fingerprint is computed in your browser; the file is never uploaded.</p>
            <input type="file" multiple className="is-size-7 has-text-grey-light" onChange={e => verify([...e.target.files])} />
            {checks.map((c, i) => (
              <p key={i} className="is-size-7 mt-2" style={{ color: c.match ? '#48c78e' : '#f14668' }}>
                {c.match ? '✅' : '❌'} {c.name} — {c.match ? `matches ${c.match}` : 'no match in this record'}
                <br /><span style={{ fontFamily: 'monospace', color: '#888' }}>{c.hash}</span>
              </p>
            ))}
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
