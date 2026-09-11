import { Button } from '@/components/ui/button';

export function IconButton({
  icon: Icon,
  onClick,
  variant = 'default',
  label,
}: {
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      className={
        variant === 'destructive'
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
