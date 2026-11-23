import { FormEvent, useState } from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import type { User } from '../types/index';
import { authApi } from '../services/auth-api';
import { messageOf } from '../shared/api';
import { LIMITS, codePoints } from '../../shared/contracts/index';

export function Profile({ user, save }: { user: User; save: (user: User) => void }) {
  const [name, setName] = useState(user.username);
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [cover, setCover] = useState(user.cover || '');
  const [location, setLocation] = useState(user.location ?? '');
  const [site, setSite] = useState(user.website ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const registeredAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('pt-BR')
    : 'Data indisponível';
  const fileToDataUrl = (file: File, apply: (value: string) => void) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type))
      return setMessage('Escolha uma imagem PNG, JPEG, GIF ou WebP.');
    if (file.size > LIMITS.imageBytes) return setMessage('A imagem deve ter no máximo 3 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      apply(String(reader.result));
      setMessage('');
    };
    reader.onerror = () => setMessage('Não foi possível ler a imagem selecionada.');
    reader.readAsDataURL(file);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return; setBusy(true); setMessage('');
    try {
    const result = await authApi.updateProfile({ username: name, bio, avatar, cover, location, website: site });
    save(result.user);
    history.pushState({}, '', '/feed.html');
    dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  };
  return (
    <section className="edit-profile">
      <header className="edit-profile-header">
        <button type="button" onClick={() => history.back()} aria-label="Voltar">
          <ArrowLeft size={19} />
        </button>
        <div>
          <strong>Editar perfil</strong>
          <small>@{name.replace(/\s/g, '').toLowerCase()}</small>
        </div>
        <button className="edit-save" type="submit" form="editProfileForm" disabled={busy || codePoints(bio.trim()) > LIMITS.bio}>
          Salvar alterações
        </button>
      </header>
      <form id="editProfileForm" onSubmit={submit}>
        <div
          className={`edit-cover ${cover ? 'has-cover' : ''}`}
          style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        >
          <label>
            Alterar capa
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) fileToDataUrl(file, setCover);
              }}
            />
          </label>
        </div>
        <div className="edit-avatar">
          <Avatar person={{ username: name, avatar }} size="large" />
          <label>
            Alterar foto
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) fileToDataUrl(file, setAvatar);
              }}
            />
          </label>
        </div>
        <section className="private-account" aria-label="Dados privados da conta">
          <header>
            <div>
              <LockKeyhole size={18} />
              <span>
                <strong>Dados da conta</strong>
                <small>Somente você pode ver estas informações</small>
              </span>
            </div>
            <span className="private-badge">Privado</span>
          </header>
          <div className="private-fields">
            <label>
              E-mail do cadastro
              <input value={user.email || ''} readOnly />
            </label>
            <label>
              Senha
              <input value="••••••••" readOnly aria-describedby="passwordPrivacyNote" />
            </label>
            <label>
              Conta criada em
              <input value={registeredAt} readOnly />
            </label>
          </div>
          <p id="passwordPrivacyNote">Por segurança, sua senha real nunca é exibida.</p>
        </section>
        <div className="edit-fields">
          <label>
            Nome público
            <input
              id="editProfileName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            Bio
            <textarea
              id="editProfileBio"
              maxLength={LIMITS.bio * 2}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Fale alguma coisa sobre você"
            />
            <span className="bio-count">{codePoints(bio.trim())}/{LIMITS.bio}</span>
          </label>
          <label>
            Localização
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Sua localização"
            />
          </label>
          <label>
            Site
            <input
              value={site}
              onChange={(event) => setSite(event.target.value)}
              placeholder="https://seusite.com"
            />
          </label>
        </div>
        <p id="editProfileMsg" className="form-message" role="alert">
          {message}
        </p>
      </form>
    </section>
  );
}
