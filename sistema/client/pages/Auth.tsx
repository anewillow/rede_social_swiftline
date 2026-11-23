import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { User } from '../types/index';
import { authApi } from '../services/auth-api';
import { messageOf } from '../shared/api';

export function Auth({ onLogin, notice, retrySession }: { onLogin: (user: User) => void; notice?: string; retrySession?: () => void }) {
  const [register, setRegister] = useState(location.pathname.includes('register'));
  const [message, setMessage] = useState('');
  const [legalDocument, setLegalDocument] = useState<'terms' | 'privacy' | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (busy) return; setBusy(true); setMessage('');
    try {
    if (register) {
      await authApi.register({ username: String(data.username ?? ''), email: String(data.email ?? ''), password: String(data.password ?? ''), acceptedTerms: data.acceptedTerms === 'true' });
      setRegister(false);
      return setMessage('Conta criada. Entre para continuar.');
    }
    const result = await authApi.login({ email: String(data.email ?? ''), password: String(data.password ?? '') });
    localStorage.setItem('token', result.token);
    onLogin(result.user);
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  };
  return (
    <main className="auth-shell auth-shell-register">
      <section className="auth-intro">
        <p className="brand">swiftline</p>
        <h1>O que está acontecendo agora?</h1>
        <p className="register-promise">
          Pessoas reais. Conversas de verdade.<br />
          Um espaço para compartilhar ideias,<br />
          descobrir novos pontos de vista<br />
          e se sentir mais perto do que importa.
        </p>
        <div className="register-tagline">
          <span aria-hidden="true" />
          <p>MAIS CONEXÕES<br />PARA UM AMANHÃ MAIS SEU.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>{register ? 'Crie sua conta' : 'Entre na Swiftline'}</h2>
          <form id={register ? 'registerForm' : 'loginForm'} onSubmit={submit}>
            {register && (
              <label>
                Nome de usuário
                <input name="username" required />
              </label>
            )}
            <label>
              E-mail
              <input id="email" name="email" type="email" required />
            </label>
            <label>
              Senha
              <span className="password-field">
                <input
                  id="password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setPasswordVisible(!passwordVisible)}
                >
                  {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>
            {register && (
              <div className="legal-acceptance">
                <input
                  id="acceptedTerms"
                  name="acceptedTerms"
                  type="checkbox"
                  value="true"
                  aria-describedby="legalAcceptanceText"
                  required
                />
                <p id="legalAcceptanceText">
                  Li e aceito os{' '}
                  <button type="button" className="legal-link" onClick={() => setLegalDocument('terms')}>
                    Termos de Uso
                  </button>{' '}
                  e a{' '}
                  <button type="button" className="legal-link" onClick={() => setLegalDocument('privacy')}>
                    Política de Privacidade
                  </button>
                </p>
              </div>
            )}
            <button type="submit" disabled={busy}>{busy ? 'Aguarde...' : register ? 'Criar conta' : 'Entrar'}</button>
          </form>
          {(message || notice) && <p className="form-message" role="alert">{message || notice} {notice && retrySession && <button type="button" onClick={retrySession}>Tentar novamente</button>}</p>}
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setMessage('');
              setLegalDocument(null);
              setPasswordVisible(false);
            }}
          >
            {register ? 'Já tenho uma conta' : 'Criar uma conta'}
          </button>
        </div>
      </section>
      {legalDocument && (
        <div
          className="legal-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLegalDocument(null);
          }}
        >
          <section
            className="legal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legalModalTitle"
          >
            <header>
              <span>SWIFTLINE · VERSÃO 1.0</span>
              <button type="button" aria-label="Fechar" onClick={() => setLegalDocument(null)}>
                ×
              </button>
            </header>
            <h2 id="legalModalTitle">
              {legalDocument === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}
            </h2>
            {legalDocument === 'terms' ? (
              <div className="legal-copy">
                <p>
                  Ao criar uma conta, você concorda em usar a Swiftline de forma responsável e
                  respeitosa.
                </p>
                <h3>Uso da plataforma</h3>
                <p>
                  Você é responsável pelas informações da sua conta e pelo conteúdo que publicar.
                  Não é permitido publicar conteúdo ilegal, ofensivo ou que viole direitos de outras
                  pessoas.
                </p>
                <h3>Segurança da conta</h3>
                <p>
                  Mantenha sua senha protegida e informe qualquer uso não autorizado da sua conta.
                </p>
              </div>
            ) : (
              <div className="legal-copy">
                <p>
                  Esta política explica como tratamos os dados fornecidos durante o uso da Swiftline.
                </p>
                <h3>Dados utilizados</h3>
                <p>
                  Utilizamos nome de usuário e e-mail para criar e identificar sua conta. A senha é
                  armazenada de forma protegida e nunca é exibida.
                </p>
                <h3>Finalidade</h3>
                <p>
                  Os dados são usados para autenticação, funcionamento do perfil e recursos sociais
                  da plataforma.
                </p>
              </div>
            )}
            <button type="button" className="legal-understood" onClick={() => setLegalDocument(null)}>
              Entendi
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
