import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import { ReactNode } from "react";

interface ConfirmDeleteProps {
  onConfirm: () => void;
  title?: string;
  description?: string;
  trigger?: ReactNode;
  variant?: "icon" | "badge";
}

export function ConfirmDelete({
  onConfirm,
  title = "Удалить?",
  description = "Это действие необратимо.",
  trigger,
  variant = "icon",
}: ConfirmDeleteProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || (
          variant === "badge" ? (
            <button className="ml-0.5 hover:opacity-70 rounded-full">
              <X className="h-2.5 w-2.5" />
            </button>
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3 w-3" />
            </Button>
          )
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
