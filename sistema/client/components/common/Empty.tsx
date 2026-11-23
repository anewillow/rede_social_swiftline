import { Plus } from 'lucide-react';

export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <Plus size={21} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
