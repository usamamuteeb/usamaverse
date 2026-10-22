'use client';

import { cleanCv, contactItems, dateRange, toUrl, type CvData } from './cv-model';
import type { CvStyle } from './cv-pdf';

/** Paper-like rendering of a CV. Colors are fixed (it is a document), so it looks the same in light and dark mode. */
export function CvPreview({ cv: input, style }: { cv: CvData; style: CvStyle }) {
  const cv = cleanCv(input);
  const b = cv.basics;
  const contacts = contactItems(b);
  const cls = ['cv-paper', `cv-${style.font}`, `cv-${style.align}`, style.density === 'compact' ? 'cv-compact' : ''].filter(Boolean).join(' ');
  const empty = !b.name && !cv.sections.length && !b.summary;
  return (
    <div className="cv-preview-wrap">
      <article className={cls} style={{ ['--cv-accent' as string]: style.accent }} aria-label="CV preview">
        {empty ? (
          <p className="cv-empty">Your CV preview appears here as you type.</p>
        ) : (
          <>
            <header className="cv-head">
              <h1>{b.name || 'Your Name'}</h1>
              {b.label && <p className="cv-label">{b.label}</p>}
              {contacts.length > 0 && (
                <p className="cv-contacts">
                  {contacts.map((c, i) => (
                    <span key={i}>
                      {c.href ? (
                        <a href={c.href} target="_blank" rel="noopener noreferrer">
                          {c.text}
                        </a>
                      ) : (
                        c.text
                      )}
                    </span>
                  ))}
                </p>
              )}
            </header>
            {b.summary && (
              <section className="cv-sec">
                <h2>Summary</h2>
                <p>{b.summary}</p>
              </section>
            )}
            {cv.sections.map((s) => (
              <section className="cv-sec" key={s.id}>
                <h2>{s.heading}</h2>
                {s.kind === 'text' && s.text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                {s.kind === 'list' && (
                  <ul>
                    {s.items.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                )}
                {s.kind === 'skills' &&
                  s.skills.map((g, i) => (
                    <p key={i} className="cv-skill">
                      {g.name && <strong>{g.name}: </strong>}
                      {g.items}
                    </p>
                  ))}
                {s.kind === 'entries' &&
                  s.entries.map((e, i) => (
                    <div className="cv-entry" key={i}>
                      <div className="cv-row">
                        <strong>{e.title || e.org}</strong>
                        <span>{dateRange(e)}</span>
                      </div>
                      {((e.title && e.org) || e.location) && (
                        <div className="cv-row cv-sub">
                          <em>{e.title ? e.org : ''}</em>
                          <em>{e.location}</em>
                        </div>
                      )}
                      {e.details && <p>{e.details}</p>}
                      {e.url && (
                        <p>
                          <a href={toUrl(e.url)} target="_blank" rel="noopener noreferrer">
                            {e.url.replace(/^https?:\/\//, '')}
                          </a>
                        </p>
                      )}
                      {e.bullets.length > 0 && (
                        <ul>
                          {e.bullets.map((x, j) => (
                            <li key={j}>{x}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </section>
            ))}
          </>
        )}
      </article>
    </div>
  );
}
