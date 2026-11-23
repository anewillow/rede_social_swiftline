import { FormEvent, useState } from 'react';
import { Contrast, Settings, ShieldCheck, Trash2, X } from 'lucide-react';
import type { User, Page } from '../types/index';
import { authApi } from '../services/auth-api';
import { messageOf } from '../shared/api';

export function AccountSettings({
  user,
  go,
  onDeleted,
  highContrast,
  onHighContrastChange,
}: {
  user: User;
  go: (page: Page) => void;
  onDeleted: () => void;
  highContrast: boolean;
  onHighContrastChange: (enabled: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const closeConfirmation = () => {
    if (deleting || deleted) return;
    setConfirming(false);
    setPassword('');
    setMessage('');
  };

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleting(true);
    setMessage('');
    try {
      await authApi.deleteAccount({ password });
      setPassword('');
      setDeleted(true);
      window.setTimeout(onDeleted, 2600);
    } catch (error) {
      setMessage(messageOf(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="account-settings">
      <header className="settings-header">
        <span className="settings-title-icon" aria-hidden="true">
          <Settings size={21} />
        </span>
        <div>
          <h1>Configurações</h1>
          <p>Gerencie seu perfil e os dados da sua conta.</p>
        </div>
      </header>

      <article className="settings-account-card">
        <div className="settings-card-icon" aria-hidden="true">
          <ShieldCheck size={21} />
        </div>
        <div>
          <h2>Conta</h2>
          <p>{user.email}</p>
        </div>
        <button type="button" onClick={() => go('profile')}>
          Editar perfil
        </button>
      </article>

      <article className="settings-contrast-card">
        <span className="settings-card-icon contrast-card-icon" aria-hidden="true">
          <Contrast size={21} />
        </span>
        <div className="contrast-card-copy">
          <span className="settings-card-label">Acessibilidade</span>
          <h2>Alto contraste</h2>
          <p>Aumenta a diferença entre textos, fundos, bordas e botões.</p>
        </div>
        <div className="contrast-setting-control">
          <span className="contrast-status" aria-live="polite">
            {highContrast ? 'Ativado' : 'Desativado'}
          </span>
          <button
            type="button"
            className={`contrast-switch ${highContrast ? 'active' : ''}`}
            role="switch"
            aria-checked={highContrast}
            aria-label={`${highContrast ? 'Desativar' : 'Ativar'} o modo de alto contraste`}
            onClick={() => onHighContrastChange(!highContrast)}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </article>

      <article className="danger-zone">
        <div>
          <span className="danger-icon" aria-hidden="true">
            <Trash2 size={22} />
          </span>
          <span>
            <h2>Excluir conta</h2>
            <p>Esta ação excluirá permanentemente sua conta e não poderá ser desfeita.</p>
          </span>
        </div>
        <button type="button" onClick={() => setConfirming(true)}>
          Excluir minha conta
        </button>
      </article>

      {confirming && (
        <div
          className="delete-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirmation();
          }}
        >
          <section
            className={`delete-modal ${deleted ? 'delete-modal-success' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteAccountTitle"
          >
            {deleted ? (
              <div className="delete-success" role="status" aria-live="polite">
                <div className="farewell-animation" aria-hidden="true">
                  <span>✦</span>
                  <span>●</span>
                  <span>✦</span>
                  <span>●</span>
                  <span>✦</span>
                </div>
                <span className="success-check" aria-hidden="true">✓</span>
                <h2 id="deleteAccountTitle">Conta excluída com sucesso!</h2>
                <p>Foi bom ter você por aqui. Até logo!</p>
                <small>Voltando para o login...</small>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="delete-modal-close"
                  aria-label="Fechar"
                  onClick={closeConfirmation}
                  disabled={deleting}
                >
                  <X size={21} />
                </button>
                <span className="delete-modal-icon" aria-hidden="true">
                  <Trash2 size={25} />
                </span>
                <h2 id="deleteAccountTitle">Excluir conta?</h2>
                <p>
                  Tem certeza de que deseja excluir sua conta? Esta ação não poderá ser desfeita.
                </p>
                <form onSubmit={deleteAccount}>
                  <label htmlFor="deleteAccountPassword">
                    Digite sua senha para confirmar
                    <input
                      id="deleteAccountPassword"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      autoFocus
                    />
                  </label>
                  {message && <p className="delete-message">{message}</p>}
                  <div className="delete-modal-actions">
                    <button type="button" onClick={closeConfirmation} disabled={deleting}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={!password || deleting}>
                      {deleting ? 'Excluindo...' : 'Excluir conta'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
