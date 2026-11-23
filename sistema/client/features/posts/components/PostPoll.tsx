import { FormEvent, useState } from 'react';
import { BarChart3, Pencil, Trash2 } from 'lucide-react';
import type { Post } from '../../../types/index';
import { postsApi } from '../../../services/posts-api';
import { messageOf } from '../../../shared/api';
import { LIMITS, codePoints } from '../../../../shared/contracts/index';

export function PostPoll({
  post,
  onUpdate,
  onPollDeleted,
}: {
  post: Post;
  onUpdate: (postId: number, patch: Partial<Post>) => void;
  onPollDeleted: (postId: number) => void;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [voteConfirmed, setVoteConfirmed] = useState(false);
  const [showResults, setShowResults] = useState(
    Boolean(post.poll?.votedOptionId || post.pollPermissions?.canManage),
  );
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState(post.content);
  const [editOptions, setEditOptions] = useState(
    () => post.poll?.options.map((option) => ({ id: option.id, text: option.text })) ?? [],
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingPoll, setDeletingPoll] = useState(false);
  const [ownerMessage, setOwnerMessage] = useState('');
  if (!post.poll) return null;
  const hasVoted = post.poll.votedOptionId !== null;
  const canManage = Boolean(post.pollPermissions?.canManage);
  const vote = async () => {
    if (voting || hasVoted || selectedOptionId === null) return;
    setVoting(true);
    setError('');
    try {
      const result = await postsApi.vote(post.id, { optionId: selectedOptionId });
      onUpdate(post.id, { poll: result.poll });
      setVoteConfirmed(true);
      setShowResults(true);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setVoting(false);
    }
  };
  const startEditing = () => {
    setEditQuestion(post.content);
    setEditOptions(post.poll!.options.map((option) => ({ id: option.id, text: option.text })));
    setOwnerMessage('');
    setConfirmingDelete(false);
    setEditing(true);
  };
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingEdit) return;
    const question = editQuestion.trim();
    const options = editOptions.map((option) => ({ ...option, text: option.text.trim() }));
    if (!question) return setOwnerMessage('A pergunta não pode ficar vazia.');
    if (codePoints(question) > LIMITS.post) return setOwnerMessage('A pergunta deve ter no máximo 280 caracteres.');
    if (options.some((option) => !option.text))
      return setOwnerMessage('Preencha todas as opções.');
    if (
      new Set(options.map((option) => option.text.toLocaleLowerCase('pt-BR'))).size !==
      options.length
    )
      return setOwnerMessage('As opções precisam ser diferentes.');
    setSavingEdit(true);
    setOwnerMessage('');
    try {
      const result = await postsApi.updatePoll(post.id, { question, options });
      onUpdate(post.id, result.post);
      setEditing(false);
      setOwnerMessage('Enquete atualizada.');
    } catch (error) {
      setOwnerMessage(messageOf(error));
    } finally {
      setSavingEdit(false);
    }
  };
  const deletePoll = async () => {
    if (deletingPoll) return;
    setDeletingPoll(true);
    setOwnerMessage('');
    try {
      await postsApi.deletePoll(post.id);
      onPollDeleted(post.id);
    } catch (error) {
      setOwnerMessage(messageOf(error));
    } finally {
      setDeletingPoll(false);
    }
  };
  return (
    <section
      className={hasVoted ? 'post-poll results-visible' : 'post-poll'}
      aria-label="Enquete"
      aria-busy={voting || savingEdit || deletingPoll}
    >
      <header className="post-poll-header">
        <span className="post-poll-label"><BarChart3 size={14} /> Enquete</span>
        {canManage && !editing && (
          <div className="poll-owner-actions" aria-label="Ações do autor da enquete">
            <button type="button" onClick={startEditing}>
              <Pencil size={14} /> Editar
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setConfirmingDelete(true);
                setOwnerMessage('');
              }}
            >
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        )}
      </header>

      {editing ? (
        <form className="poll-owner-editor" onSubmit={saveEdit}>
          <label>
            Pergunta
            <textarea
              maxLength={LIMITS.post * 2}
              value={editQuestion}
              onChange={(event) => setEditQuestion(event.target.value)}
            />
          </label>
          <div>
            {editOptions.map((option, index) => (
              <label key={option.id}>
                Opção {String.fromCharCode(65 + index)}
                <input
                  maxLength={LIMITS.pollOption * 2}
                  value={option.text}
                  onChange={(event) =>
                    setEditOptions((items) =>
                      items.map((item) =>
                        item.id === option.id ? { ...item, text: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <footer>
            <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
            <button type="submit" className="save" disabled={savingEdit}>
              {savingEdit ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </footer>
        </form>
      ) : showResults ? (
        <div className="poll-chart" aria-label="Gráfico de resultados da enquete">
          <div className="poll-chart-title">
            <strong>Resultado</strong>
            {!hasVoted && (
              <button type="button" onClick={() => setShowResults(false)}>Votar nesta enquete</button>
            )}
          </div>
          {post.poll.options.map((option) => {
            const percentage = post.poll?.totalVotes
              ? Math.round((option.votes / post.poll.totalVotes) * 100)
              : 0;
            const selected = post.poll?.votedOptionId === option.id;
            return (
              <div className={selected ? 'poll-chart-row selected' : 'poll-chart-row'} key={option.id}>
                <div>
                  <span>{selected && <span aria-hidden="true">✓</span>}{option.text}</span>
                  <strong>{percentage}%</strong>
                </div>
                <div
                  className="poll-chart-track"
                  role="progressbar"
                  aria-label={`${option.text}: ${percentage}%`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentage}
                >
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <small>{option.votes} {option.votes === 1 ? 'voto' : 'votos'}</small>
              </div>
            );
          })}
          <footer className="poll-chart-footer">
            <span>{`${post.poll.totalVotes} ${post.poll.totalVotes === 1 ? 'voto no total' : 'votos no total'}`}</span>
            {hasVoted && (
              <span className={voteConfirmed ? 'poll-vote-success visible' : 'poll-vote-success'} role="status">
                <span aria-hidden="true">✓</span> Voto registrado
              </span>
            )}
          </footer>
        </div>
      ) : (
        <>
          <div className="post-poll-options" role="radiogroup">
            {post.poll.options.map((option) => {
              const pendingSelection = selectedOptionId === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  className={pendingSelection ? 'pending-selection' : ''}
                  disabled={voting}
                  role="radio"
                  aria-checked={pendingSelection}
                  onClick={() => {
                    setSelectedOptionId(option.id);
                    setError('');
                  }}
                >
                  <span className="poll-option-text">
                    <span className="poll-option-marker" aria-hidden="true">
                      {pendingSelection ? '✓' : ''}
                    </span>
                    {option.text}
                  </span>
                </button>
              );
            })}
          </div>
          <footer className="poll-vote-footer">
            <button type="button" className="poll-show-chart" onClick={() => setShowResults(true)}>
              <BarChart3 size={14} /> Ver gráfico
            </button>
            <span>Um voto por pessoa</span>
            <button
              type="button"
              className="poll-confirm-vote"
              disabled={selectedOptionId === null || voting}
              onClick={() => void vote()}
            >
              {voting ? 'Confirmando...' : 'Confirmar voto'}
            </button>
          </footer>
        </>
      )}

      {confirmingDelete && (
        <div className="poll-delete-confirm" role="alert">
          <span>Excluir a enquete e todos os votos?</span>
          <div>
            <button type="button" onClick={() => setConfirmingDelete(false)}>Cancelar</button>
            <button type="button" className="danger" disabled={deletingPoll} onClick={() => void deletePoll()}>
              {deletingPoll ? 'Excluindo...' : 'Excluir enquete'}
            </button>
          </div>
        </div>
      )}
      {ownerMessage && <p className="poll-owner-message" role="status">{ownerMessage}</p>}
      {error && <p className="poll-vote-error" role="alert">{error}</p>}
    </section>
  );
}
