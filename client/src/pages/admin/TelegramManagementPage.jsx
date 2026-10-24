import { useState } from 'react';
import { Activity, Bot, Check, CircleAlert, Eye, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { adminService } from '../../services/index.js';
import { unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'Amharic' },
  { code: 'om', label: 'Afaan Oromo' },
];

const BLANK_MENU = {
  key: '',
  labels: { en: '', am: '', om: '' },
  responses: { en: '', am: '', om: '' },
  actionType: 'TEXT',
  targetUrl: '',
  visibility: 'EVERYONE',
  sortOrder: 0,
  isActive: false,
};

const BLANK_RULE = {
  name: '',
  keywords: '',
  matchType: 'CONTAINS',
  responses: { en: '', am: '', om: '' },
  priority: 100,
  isActive: false,
};

function ManagementTabs({ active }) {
  const tabs = [
    ['Overview', '/admin/telegram'],
    ['Menu builder', '/admin/telegram/menu'],
    ['Auto-reply rules', '/admin/telegram/auto-replies'],
    ['Inbox', '/admin/telegram-inbox'],
  ];
  return (
    <nav className="telegram-management-tabs" aria-label="Telegram management">
      {tabs.map(([label, to]) => (
        <NavLink key={to} to={to} end={to === '/admin/telegram'} className={`btn btn-sm ${active === to ? 'btn-primary' : 'btn-secondary'}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function WorkspaceHeader({ active, title, description, children }) {
  return (
    <div className="stack-lg telegram-management-workspace">
      <div className="page-head">
        <div>
          <span className="eyebrow blue"><Bot size={15} /> Telegram management</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </div>
      <ManagementTabs active={active} />
    </div>
  );
}

function OverviewPanel() {
  const overview = useAsync(async () => unwrap(await adminService.telegramManagementOverview()), []);
  const [connection, setConnection] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testError, setTestError] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const stats = overview.data;

  async function checkConnection() {
    setCheckingConnection(true);
    setConnectionError('');
    try {
      setConnection(unwrap(await adminService.checkTelegramConnection()));
    } catch (error) {
      setConnection(null);
      setConnectionError(error.message || 'Telegram connection could not be checked.');
    } finally {
      setCheckingConnection(false);
    }
  }

  async function sendTest() {
    setSendingTest(true);
    setTestError('');
    setTestResult('');
    try {
      const response = await adminService.sendTelegramAdminTest();
      setTestResult(response.data?.message || 'Telegram accepted the test message. Check your linked chat.');
    } catch (error) {
      setTestError(error.message || 'The test message was not delivered.');
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="stack-lg telegram-management-workspace">
      <WorkspaceHeader active="/admin/telegram" title="Telegram overview" description="Live operational counts from the existing church bot, linked-member records, inbox, and saved bot configuration.">
        <Button variant="secondary" iconLeft={<RefreshCw size={15} />} onClick={overview.reload}>Refresh</Button>
      </WorkspaceHeader>
      {overview.loading ? <div className="card">Loading Telegram status…</div>
        : overview.error ? <ErrorMessage error={overview.error} onRetry={overview.reload} title="Telegram status could not be loaded" />
          : (
            <>
              {!stats?.configured ? <Alert variant="warning">The server has no Telegram bot token configured. Configuration and previews work, but live bot delivery is unavailable.</Alert> : null}
              <div className="event-grid">
                <article className="card"><span className="muted">Bot configuration</span><h2>{stats?.configured ? 'Token configured' : 'Not configured'}</h2><p className="muted">This confirms server configuration, not Telegram API connectivity.</p></article>
                <article className="card"><span className="muted">Linked accounts</span><h2>{stats?.accounts?.linked ?? 0}</h2><p className="muted">{stats?.accounts?.total ?? 0} Telegram accounts recorded</p></article>
                <article className="card"><span className="muted">Inbox</span><h2>{stats?.messages?.pending ?? 0} pending</h2><p className="muted">{stats?.messages?.total ?? 0} messages received</p></article>
                <article className="card"><span className="muted">Menu items</span><h2>{stats?.menuItems?.active ?? 0} active</h2><p className="muted">{stats?.menuItems?.total ?? 0} configured</p></article>
                <article className="card"><span className="muted">Auto replies</span><h2>{stats?.autoReplies?.active ?? 0} active</h2><p className="muted">{stats?.autoReplies?.total ?? 0} configured rules</p></article>
                <article className="card"><span className="muted">Webhook processing</span><h2>{stats?.updates?.failed ?? 0} failed</h2><p className="muted">Last processed: {stats?.updates?.lastProcessedAt ? new Date(stats.updates.lastProcessedAt).toLocaleString() : 'No completed updates recorded'}</p></article>
              </div>
              <section className="card stack">
                <h2><Activity size={18} /> Connection and diagnostics</h2>
                <p>Check the live Telegram Bot API and webhook status. A test message is sent only to your own linked Telegram chat.</p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <Button type="button" variant="secondary" loading={checkingConnection} onClick={checkConnection}>Check Telegram connection</Button>
                  <Button type="button" loading={sendingTest} disabled={!stats?.configured} onClick={sendTest}>Send test to my linked chat</Button>
                </div>
                {connectionError ? <Alert variant="danger">{connectionError}</Alert> : null}
                {connection ? <Alert variant={connection.webhook.configured && !connection.webhook.lastErrorMessage ? 'info' : 'warning'}>
                  Bot @{connection.bot.username || 'unnamed'} is reachable. Webhook: {connection.webhook.configured ? 'configured' : 'not configured'}; {connection.webhook.pendingUpdates} pending updates.
                  {connection.webhook.lastErrorMessage ? ` Last Telegram error: ${connection.webhook.lastErrorMessage}` : ''}
                </Alert> : null}
                {testResult ? <Alert variant="info">{testResult}</Alert> : null}
                {testError ? <Alert variant="danger">{testError}</Alert> : null}
                <h2><Activity size={18} /> Manage the bot</h2>
                <p>Changes to saved menu buttons and auto-reply rules are used by the existing Telegram bot. Sensitive member actions remain behind its existing linked-account checks.</p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <Button to="/admin/telegram/menu">Configure bot menu</Button>
                  <Button to="/admin/telegram/auto-replies" variant="secondary">Manage auto replies</Button>
                  <Button to="/admin/telegram-inbox" variant="secondary">Review inbox</Button>
                </div>
              </section>
            </>
          )}
    </div>
  );
}

function LanguageFields({ title, values, onChange, language, multiline = false, required = true }) {
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend><strong>{title}</strong></legend>
      <label className="field">
        <span>{LANGUAGES.find((item) => item.code === language)?.label}</span>
        {multiline ? (
          <textarea className="textarea telegram-localized-textarea" rows={5} maxLength={4000} required={required} value={values?.[language] ?? ''} onChange={(event) => onChange(language, event.target.value)} />
        ) : (
          <input className="input" maxLength={64} required={required} value={values?.[language] ?? ''} onChange={(event) => onChange(language, event.target.value)} />
        )}
      </label>
    </fieldset>
  );
}

function MenuBuilderPanel() {
  const { success } = useToast();
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(BLANK_MENU);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en');
  const [editingItem, setEditingItem] = useState(null);
  const items = useAsync(async () => {
    const response = await adminService.telegramMenuItems();
    return { items: unwrap(response) ?? [], catalog: response.data?.catalog ?? { commands: [] } };
  }, [version]);
  const changeLocalized = (field) => (language, value) => setForm((current) => ({ ...current, [field]: { ...current[field], [language]: value } }));

  function edit(item) {
    setEditingId(item.id);
    setEditingItem(item);
    setLanguage('en');
    setForm({
      ...BLANK_MENU,
      ...item,
      labels: { ...BLANK_MENU.labels, ...item.labels },
      responses: { ...BLANK_MENU.responses, ...item.responses },
      targetUrl: item.targetUrl ?? '',
    });
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    const requiredTranslations = form.actionType === 'TEXT' ? ['labels', 'responses'] : ['labels'];
    const missingTranslation = requiredTranslations.some((field) => LANGUAGES.some(({ code }) => !form[field]?.[code]?.trim()));
    if (missingTranslation) {
      setError('Complete every English, Amharic, and Afaan Oromo translation before saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, sortOrder: Number(form.sortOrder) };
      if (event.nativeEvent?.submitter?.value === 'publish') payload.isActive = true;
      if (editingId) await adminService.updateTelegramMenuItem(editingId, payload);
      else await adminService.createTelegramMenuItem(payload);
      success(editingId ? 'Menu item saved' : 'Menu item created');
      setEditingId(null);
      setEditingItem(null);
      setForm(BLANK_MENU);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(reason.message || 'The menu item could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.labels?.en || item.key}” from the Telegram menu?`)) return;
    try {
      await adminService.deleteTelegramMenuItem(item.id);
      if (String(editingId) === String(item.id)) {
        setEditingId(null);
        setEditingItem(null);
        setForm(BLANK_MENU);
      }
      setVersion((value) => value + 1);
      success('Menu item deleted');
    } catch (reason) {
      setError(reason.message || 'Menu item could not be deleted.');
    }
  }

  return (
    <div className="stack-lg telegram-management-workspace">
      <WorkspaceHeader active="/admin/telegram/menu" title="Bot menu builder" description="Configure safe, localized buttons in the bot’s private-chat menu. Published items are read by the existing bot at runtime." />
      {items.loading ? <div className="card">Loading menu catalog…</div> : items.error ? <ErrorMessage error={items.error} onRetry={items.reload} title="Menu catalog unavailable" /> : (
      <div className="telegram-builder-layout">
        <section className="card stack telegram-menu-inventory">
          <div className="row-between"><div><h2>Bot menu inventory</h2><p className="muted">Built-in actions and custom buttons currently supported by the bot.</p></div><Button type="button" variant="secondary" size="sm" onClick={() => setVersion((value) => value + 1)} iconLeft={<RefreshCw size={14} />}>Refresh</Button></div>
          {(items.data?.items ?? []).map((item) => (
            <article className="telegram-menu-row" key={item.id}>
              <div className="row-between" style={{ gap: '.7rem', alignItems: 'flex-start' }}>
                <div className="telegram-menu-row-copy">
                  <div className="row"><strong>{item.labels?.en || item.key}</strong><span className={`badge ${item.isBuiltin ? 'badge-blue' : ''}`}>{item.isBuiltin ? 'Built-in' : 'Custom'}</span><span className="badge">{item.isActive ? 'Published' : 'Disabled'}</span></div>
                  <p className="muted">{item.key} · {item.actionType} · {String(item.visibility).replaceAll('_', ' ').toLowerCase()}</p>
                  <small>{LANGUAGES.map(({ code }) => item.labels?.[code]?.trim() ? code.toUpperCase() : `${code.toUpperCase()} missing`).join(' · ')}</small>
                </div>
                <div className="row">
                  <Button type="button" size="sm" variant="ghost" onClick={() => edit(item)}>Edit</Button>
                  {!item.isBuiltin ? <Button type="button" size="sm" variant="ghost" iconLeft={<Trash2 size={14} />} onClick={() => void remove(item)}>Delete</Button> : null}
                </div>
              </div>
            </article>
          ))}
          {(items.data?.catalog?.commands ?? []).length ? <details className="telegram-command-catalog">
            <summary>Existing slash commands ({items.data.catalog.commands.length})</summary>
            <div className="telegram-command-list">{items.data.catalog.commands.map((item) => <code key={item.command}>{item.command}</code>)}</div>
            <small className="muted">These are protected built-in bot handlers, not independently editable menu records.</small>
          </details> : null}
          <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setEditingItem(null); setForm(BLANK_MENU); setError(''); }}>Add custom button</Button>
        </section>
        <section className="card stack telegram-menu-editor">
          <div className="row-between"><h2>{editingId ? 'Edit menu button' : 'Add menu button'}</h2>{editingId ? <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditingItem(null); setForm(BLANK_MENU); setError(''); }}>Cancel edit</Button> : <Plus size={18} />}</div>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <form className="stack" onSubmit={save}>
            <label className="field"><span>Internal key</span><input className="input" required maxLength={64} pattern="[A-Za-z][A-Za-z0-9_]*" readOnly={editingItem?.isBuiltin} value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value.toLowerCase() }))} placeholder="church_services" />{editingItem?.isBuiltin ? <small className="muted">Built-in keys are stable to preserve their existing command handlers.</small> : null}</label>
            <div className="telegram-language-tabs" role="tablist" aria-label="Translation language">
              {LANGUAGES.map(({ code, label }) => {
                const complete = Boolean(form.labels[code]?.trim()) && (form.actionType !== 'TEXT' || Boolean(form.responses[code]?.trim()));
                return <button type="button" role="tab" aria-selected={language === code} className={language === code ? 'is-active' : ''} key={code} onClick={() => setLanguage(code)}>{label}<span aria-label={complete ? 'Translation complete' : 'Translation incomplete'}>{complete ? ' ✓' : ' •'}</span></button>;
              })}
            </div>
            <LanguageFields title="Button label" values={form.labels} language={language} onChange={changeLocalized('labels')} />
            <label className="field"><span>Action</span><select className="input" value={form.actionType} onChange={(event) => setForm((current) => ({ ...current, actionType: event.target.value }))}>
              <option value="TEXT">Send translated text</option><option value="URL">Open HTTPS website</option><option value="PROFILE">Member profile</option><option value="GROUPS">My departments</option><option value="PROGRAMS">Programs and events</option><option value="GIVING">Giving information</option><option value="CAMPAIGNS">Fundraising campaigns</option><option value="LOCATION">Church location</option><option value="CONTACT">Contact the Church</option><option value="HELP">Help</option>
            </select></label>
            {form.actionType === 'TEXT' ? <LanguageFields title="Response text" values={form.responses} language={language} onChange={changeLocalized('responses')} multiline /> : null}
            {form.actionType === 'URL' ? <label className="field"><span>HTTPS destination</span><input className="input" type="url" required value={form.targetUrl} onChange={(event) => setForm((current) => ({ ...current, targetUrl: event.target.value }))} placeholder="https://example.org" /></label> : null}
            <div className="event-grid">
              <label className="field"><span>Visibility</span><select className="input" value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}><option value="EVERYONE">All private chat users</option><option value="LINKED_MEMBER">Linked members only</option></select></label>
              <label className="field"><span>Order</span><input className="input" type="number" min="0" max="10000" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label>
            </div>
            <label className="check-label"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Publish this button in the bot menu</label>
            <div className="telegram-menu-preview"><strong><Eye size={15} /> Telegram preview · {LANGUAGES.find((item) => item.code === language)?.label}</strong><div className="telegram-preview-bubble">{form.actionType === 'TEXT' ? form.responses[language] || 'Response preview' : form.actionType === 'URL' ? form.targetUrl || 'HTTPS destination' : `${form.actionType} action`}</div><span className="telegram-preview-button">{form.labels[language] || 'Button label'}</span></div>
            <div className="row"><Button type="submit" loading={saving} iconLeft={<Save size={15} />}>{editingId ? (editingItem?.isBuiltin ? 'Save built-in configuration' : 'Save button') : 'Save draft'}</Button><button className="btn btn-secondary" type="submit" value="publish" disabled={saving}>Save and publish</button><Button type="button" variant="secondary" onClick={() => { setEditingId(null); setEditingItem(null); setForm(BLANK_MENU); setError(''); }}>Reset</Button></div>
          </form>
        </section>
      </div>
      )}
    </div>
  );
}

function AutoReplyPanel() {
  const { success } = useToast();
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(BLANK_RULE);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testText, setTestText] = useState('');
  const [preview, setPreview] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');
  const rules = useAsync(async () => unwrap(await adminService.telegramAutoReplies()) ?? [], [version]);
  const changeLocalized = (language, value) => setForm((current) => ({ ...current, responses: { ...current.responses, [language]: value } }));

  function edit(rule) {
    setEditingId(rule.id);
    setForm({ ...BLANK_RULE, ...rule, keywords: (rule.keywords ?? []).join(', '), responses: { ...BLANK_RULE.responses, ...rule.responses } });
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, keywords: form.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean), priority: Number(form.priority) };
      if (editingId) await adminService.updateTelegramAutoReply(editingId, payload);
      else await adminService.createTelegramAutoReply(payload);
      success(editingId ? 'Auto-reply rule saved' : 'Auto-reply rule created');
      setEditingId(null);
      setForm(BLANK_RULE);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(reason.message || 'The rule could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(rule) {
    if (!window.confirm(`Delete auto-reply “${rule.name}”?`)) return;
    try {
      await adminService.deleteTelegramAutoReply(rule.id);
      setVersion((value) => value + 1);
      success('Auto-reply rule deleted');
    } catch (reason) {
      setError(reason.message || 'The rule could not be deleted.');
    }
  }

  async function runPreview(event) {
    event.preventDefault();
    setTesting(true);
    setTestError('');
    try {
      setPreview(unwrap(await adminService.previewTelegramAutoReply({ text: testText })));
    } catch (reason) {
      setTestError(reason.message || 'Preview failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="stack-lg telegram-management-workspace">
      <WorkspaceHeader active="/admin/telegram/auto-replies" title="Auto-reply rules" description="Create deterministic text-matching responses in English, Amharic, and Afaan Oromo. Rules can only send text; they cannot trigger privileged member or finance actions." />
      <form className="card stack" onSubmit={runPreview}>
        <h2><Eye size={18} /> Test console</h2>
        <label className="field"><span>Sample private message</span><input className="input" required maxLength={1000} value={testText} onChange={(event) => setTestText(event.target.value)} placeholder="When does the Sunday service start?" /></label>
        <div className="row"><Button type="submit" variant="secondary" loading={testing}>Test matching rule</Button></div>
        {testError ? <Alert variant="danger">{testError}</Alert> : null}
        {preview ? <Alert variant={preview.matched ? 'info' : 'warning'}>{preview.matched ? `Matched “${preview.rule.name}”. English response: ${preview.responses.en}` : 'No active rule matches this message; the bot will show its regular menu prompt.'}</Alert> : null}
      </form>
      <div className="event-grid">
        <section className="card stack">
          <h2>Saved rules</h2>
          {rules.loading ? <p>Loading rules…</p> : rules.error ? <ErrorMessage error={rules.error} onRetry={rules.reload} title="Rules unavailable" />
            : rules.data?.length ? rules.data.map((rule) => (
              <article className="card" key={rule.id} style={{ padding: '.8rem' }}>
                <div className="row-between" style={{ gap: '.6rem' }}><div><strong>{rule.name}</strong><p className="muted">{rule.keywords.join(', ')} · {rule.matchType.toLowerCase()} · priority {rule.priority}</p><small>{rule.isActive ? 'Active' : 'Disabled'}</small></div><div className="row"><Button type="button" size="sm" variant="ghost" onClick={() => edit(rule)}>Edit</Button><Button type="button" size="sm" variant="ghost" iconLeft={<Trash2 size={14} />} onClick={() => void remove(rule)}>Delete</Button></div></div>
              </article>
            )) : <EmptyState icon={<CircleAlert size={28} />} title="No auto replies yet" description="Add a rule below. Only active rules respond to messages in private bot chats." />}
        </section>
        <section className="card stack">
          <div className="row-between"><h2>{editingId ? 'Edit auto reply' : 'Create auto reply'}</h2>{editingId ? <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingId(null); setForm(BLANK_RULE); }}>Cancel edit</Button> : null}</div>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <form className="stack" onSubmit={save}>
            <label className="field"><span>Rule name</span><input className="input" required maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="field"><span>Keywords or phrases (comma separated)</span><input className="input" required value={form.keywords} onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="service time, worship schedule" /></label>
            <div className="event-grid">
              <label className="field"><span>Match mode</span><select className="input" value={form.matchType} onChange={(event) => setForm((current) => ({ ...current, matchType: event.target.value }))}><option value="CONTAINS">Whole phrase appears</option><option value="EXACT">Exact normalized message</option></select></label>
              <label className="field"><span>Priority (lower runs first)</span><input className="input" type="number" min="0" max="10000" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} /></label>
            </div>
            <LanguageFields title="Response" values={form.responses} onChange={changeLocalized} multiline />
            <label className="check-label"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Enable rule in the live bot</label>
            <Button type="submit" loading={saving} iconLeft={<Check size={15} />}>{editingId ? 'Save rule' : 'Create rule'}</Button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function TelegramManagementPage({ section = 'overview' }) {
  if (section === 'menu') return <MenuBuilderPanel />;
  if (section === 'auto-replies') return <AutoReplyPanel />;
  return <OverviewPanel />;
}
