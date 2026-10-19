'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { SelectField, TextAreaField } from '@/components/tool-kit/fields';

export function FeedbackComposer({ email }: { email: string }) {
  const [kind, setKind] = useState('bug');
  const [text, setText] = useState('');
  const body = `Type: ${kind}\n\n${text}`;
  return (
    <div className="stack">
      <SelectField label="Type" value={kind} onChange={setKind} options={[{ value: 'bug', label: 'Something is broken' }, { value: 'idea', label: 'Tool idea' }, { value: 'other', label: 'Other' }]} />
      <TextAreaField label="Your message" value={text} onChange={setText} rows={8} mono={false} hint="Please don’t include passwords or personal data." />
      <div className="actions">
        {email ? (
          <a className={`btn btn-primary${text.trim() ? '' : ' is-disabled'}`} aria-disabled={!text.trim()} href={text.trim() ? `mailto:${email}?subject=${encodeURIComponent(`Feedback: ${kind}`)}&body=${encodeURIComponent(body)}` : undefined}>
            Open in your email app
          </a>
        ) : null}
        <CopyButton text={text.trim() ? body : ''} label="Copy message" />
      </div>
      {!email && <p className="field-hint">A feedback address hasn’t been set up yet. You can copy your message for now.</p>}
    </div>
  );
}
