import { useState } from 'react';
import { Bookmark, CircleHelp, MessageSquare, Plus, Search, Send, Settings, X } from 'lucide-react';
import type { Page } from '../types/index';

export function Help({ go }: { go: (page: Page) => void }) {
  const [query, setQuery] = useState('');
  const [openGuide, setOpenGuide] = useState<string | null>('publicar');
  const guides = [
    {
      id: 'publicar',
      title: 'Publicar',
      description: 'Crie uma publicação com texto, imagem ou emoji.',
      icon: Send,
      steps: [
        'Abra a página Início.',
        'Escreva no campo “O que está acontecendo?”. O limite é de 280 caracteres.',
        'Se quiser, adicione uma imagem ou um emoji.',
        'Clique em Postar e aguarde o aviso Publicando...',
      ],
      action: 'Criar uma publicação',
      target: 'feed' as Page,
    },
    {
      id: 'mensagem',
      title: 'Enviar mensagem',
      description: 'Inicie ou continue uma conversa privada.',
      icon: MessageSquare,
      steps: [
        'Abra Mensagens no menu.',
        'Escolha uma pessoa na lista de conversas.',
        'Escreva no campo que fica na parte inferior da tela.',
        'Clique no botão de envio e aguarde o aviso Enviando...',
      ],
      action: 'Abrir mensagens',
      target: 'messages' as Page,
    },
    {
      id: 'salvar',
      title: 'Salvar publicação',
      description: 'Guarde uma publicação para encontrar depois.',
      icon: Bookmark,
      steps: [
        'Encontre a publicação desejada no feed.',
        'Clique no ícone de marcador abaixo da publicação.',
        'Abra Salvos no menu para ver tudo que foi guardado.',
        'Para remover, clique novamente no marcador.',
      ],
      action: 'Ver publicações salvas',
      target: 'saved' as Page,
    },
    {
      id: 'perfil',
      title: 'Alterar o perfil',
      description: 'Atualize seu nome, bio, foto ou imagem de capa.',
      icon: Settings,
      steps: [
        'Abra Perfil no menu.',
        'Altere o nome, a bio, a foto ou a capa.',
        'Revise as informações preenchidas.',
        'Clique em Salvar alterações.',
      ],
      action: 'Editar meu perfil',
      target: 'profile' as Page,
    },
    {
      id: 'erro-publicacao',
      title: 'Publicação não enviada',
      description: 'Saiba o que fazer quando aparecer uma mensagem de erro.',
      icon: CircleHelp,
      steps: [
        'Confira se o sistema e sua conexão estão funcionando.',
        'Não apague o texto: ele continuará no campo.',
        'Clique em Tentar novamente.',
        'Aguarde até a publicação aparecer no feed.',
      ],
      action: 'Voltar ao início',
      target: 'feed' as Page,
    },
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const filteredGuides = guides.filter((guide) =>
    [guide.title, guide.description, ...guide.steps]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(normalizedQuery),
  );
  const openTarget = (target: Page) => {
    go(target);
    if (target === 'feed')
      requestAnimationFrame(() => document.getElementById('post-text')?.focus());
  };
  return (
    <section className="page-section help-page">
      <header className="help-header">
        <span className="help-header-icon" aria-hidden="true">
          <CircleHelp size={24} />
        </span>
        <div>
          <p className="eyebrow">CENTRAL DE AJUDA</p>
          <h1>Como usar o Swiftline</h1>
          <p>Orientações rápidas para as principais tarefas do sistema.</p>
        </div>
      </header>
      <label className="help-search">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Digite uma dúvida, por exemplo: salvar"
          aria-label="Buscar na ajuda"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca">
            <X size={16} />
          </button>
        )}
      </label>
      <p className="help-result-count">
        {filteredGuides.length === 1
          ? '1 orientação encontrada'
          : `${filteredGuides.length} orientações encontradas`}
      </p>
      <div className="help-topics">
        {filteredGuides.map(({ id, title, description, icon: Icon, steps, action, target }) => {
          const expanded = openGuide === id;
          return (
            <article className={expanded ? 'open' : ''} key={id}>
              <button
                type="button"
                className="help-topic-button"
                aria-expanded={expanded}
                onClick={() => setOpenGuide(expanded ? null : id)}
              >
                <span className="help-card-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <Plus className="help-expand-icon" size={19} aria-hidden="true" />
              </button>
              {expanded && (
                <div className="help-topic-content">
                  <ol>
                    {steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <button type="button" className="help-action" onClick={() => openTarget(target)}>
                    {action}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!filteredGuides.length && (
        <div className="help-empty">
          <CircleHelp size={24} />
          <strong>Nenhuma orientação encontrada</strong>
          <p>Tente buscar por publicar, mensagem, salvar, perfil ou erro.</p>
        </div>
      )}
    </section>
  );
}
