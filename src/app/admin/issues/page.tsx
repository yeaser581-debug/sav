import { MessageSquare } from 'lucide-react';

export default function AdminIssuesPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sélectionnez une réclamation</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Choisissez une conversation dans la liste pour voir les détails et échanger avec le résident.
      </p>
    </div>
  );
}
