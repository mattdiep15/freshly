import { Leekly } from "@/app/_components/ui/Leekly";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <Leekly pose="fridge" className="empty-state-art" />
      <p>{message}</p>
    </div>
  );
}
