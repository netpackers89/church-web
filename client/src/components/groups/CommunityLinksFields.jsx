import { Plus, Trash2 } from 'lucide-react';

const platforms = [
  ['telegram', 'Telegram'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
];

const blankLink = () => ({ platform: 'telegram', label: '', url: '', enabled: true });

export default function CommunityLinksFields({ value = [], onChange }) {
  const links = Array.isArray(value) ? value : [];
  const updateLink = (index, patch) => {
    onChange(links.map((link, currentIndex) => currentIndex === index ? { ...link, ...patch } : link));
  };

  return (
    <fieldset className="community-links-fields">
      <legend>External community links</legend>
      <p className="muted">Add HTTPS invitation or channel links. Disabled links remain saved but are hidden from visitors.</p>
      {links.map((link, index) => (
        <div className="community-link-editor-row" key={`community-link-${index}`}>
          <label>
            Platform
            <select className="select" value={link.platform || 'other'} onChange={(event) => updateLink(index, { platform: event.target.value })}>
              {platforms.map(([platform, label]) => <option key={platform} value={platform}>{label}</option>)}
            </select>
          </label>
          <label>
            Display name
            <input className="input" maxLength={80} value={link.label || ''} placeholder="e.g. Youth Telegram group" onChange={(event) => updateLink(index, { label: event.target.value })} />
          </label>
          <label className="community-link-url">
            HTTPS URL
            <input className="input" type="url" required value={link.url || ''} placeholder="https://…" onChange={(event) => updateLink(index, { url: event.target.value })} />
          </label>
          <label className="check community-link-enabled">
            <input type="checkbox" checked={link.enabled !== false} onChange={(event) => updateLink(index, { enabled: event.target.checked })} />
            <span>Enabled</span>
          </label>
          <button className="community-link-remove" type="button" aria-label={`Remove ${link.label || 'community link'}`} onClick={() => onChange(links.filter((_, currentIndex) => currentIndex !== index))}>
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onChange([...links, blankLink()])}>
        <Plus size={15} /> Add a link
      </button>
    </fieldset>
  );
}
