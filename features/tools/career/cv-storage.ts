/** The CV Builder draft lives only in this browser's localStorage. */
import type { CvData } from './cv-model';
import { jsonToCv } from './cv-json';

const KEY = 'usamaverse:v1:cv-draft';
const PREF = 'usamaverse:v1:cv-remember';
export const BUILDER_HREF = '/workspaces/cv-studio?tool=cv-builder';

export function loadDraft(): CvData | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? jsonToCv(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(cv: CvData): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cv));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

export function rememberPref(): boolean {
  try {
    return window.localStorage.getItem(PREF) !== 'off';
  } catch {
    return false;
  }
}

export function setRememberPref(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(PREF);
    else window.localStorage.setItem(PREF, 'off');
  } catch {
    /* storage blocked */
  }
}

/** Hands a parsed CV to the builder (used by the converters' “Edit in CV Builder”). */
export function sendToBuilder(cv: CvData): boolean {
  return saveDraft(cv);
}

export function fileStem(cv: CvData): string {
  const s = (cv.basics.name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s ? `${s}-cv` : 'my-cv';
}
