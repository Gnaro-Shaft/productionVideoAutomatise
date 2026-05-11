'use client';

import { CreateProjectInput, type ProjectSummary } from '@pva/shared-types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

/**
 * RFC4122 v4 — works in non-secure contexts (HTTP on LAN IP) where
 * `crypto.randomUUID()` is unavailable. Uses Web Crypto getRandomValues
 * (available on http://<lan-ip> too) with manual byte massaging.
 */
function uuidv4(): string {
  // Prefer the native one when present (HTTPS or localhost).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  buf[6] = (buf[6]! & 0x0f) | 0x40; // version 4
  buf[8] = (buf[8]! & 0x3f) | 0x80; // variant 10x
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function CreateProjectForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const platformHintRaw = (formData.get('platformHint') as string) || '';
    const styleHintRaw = (formData.get('styleHint') as string) || '';

    const raw = {
      title: formData.get('title') as string,
      prompt: formData.get('prompt') as string,
      format: formData.get('format') as string,
      durationTargetSec: Number(formData.get('durationTargetSec')),
      sourceLocale: formData.get('sourceLocale') as string,
      styleHint: styleHintRaw || undefined,
      platformHint: platformHintRaw || undefined,
    };

    const parsed = CreateProjectInput.safeParse(raw);
    if (!parsed.success) {
      setError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '),
      );
      setSubmitting(false);
      return;
    }

    try {
      const project = await api<ProjectSummary>('/v1/projects', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
        idempotencyKey: uuidv4(),
      });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Title" name="title" required />
      <Field
        label="Prompt"
        name="prompt"
        textarea
        required
        placeholder="un samouraï solitaire dans une forêt enneigée à l'aube"
      />

      <div className="grid grid-cols-2 gap-4">
        <Select label="Format" name="format" defaultValue="VERTICAL_9_16">
          <option value="VERTICAL_9_16">9:16 Vertical (TikTok)</option>
          <option value="HORIZONTAL_16_9">16:9 Horizontal (YouTube)</option>
          <option value="SQUARE_1_1">1:1 Square (Instagram)</option>
        </Select>
        <Field
          label="Duration (s)"
          name="durationTargetSec"
          type="number"
          defaultValue="30"
          min="10"
          max="300"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select label="Source language" name="sourceLocale" defaultValue="fr-FR">
          <option value="fr-FR">Français</option>
          <option value="en-US">English (US)</option>
          <option value="es-ES">Español</option>
        </Select>
        <Select label="Platform" name="platformHint" defaultValue="">
          <option value="">— none —</option>
          <option value="tiktok">TikTok</option>
          <option value="reels">Instagram Reels</option>
          <option value="youtube_short">YouTube Shorts</option>
          <option value="youtube_long">YouTube</option>
          <option value="linkedin">LinkedIn</option>
        </Select>
      </div>

      <Field label="Style hint" name="styleHint" placeholder="cinematic, mélancolique" />

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {submitting ? 'Starting workflow…' : 'Create & start'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  textarea,
  required,
  defaultValue,
  placeholder,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  textarea?: boolean;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  min?: string;
  max?: string;
}) {
  const cls =
    'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none';
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-400">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          min={min}
          max={max}
          className={cls}
        />
      )}
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-400">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}
