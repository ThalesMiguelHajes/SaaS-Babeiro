"use client";

import { CheckIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from "../actions";

type Category = { id: string; name: string };

export function CategoryManager({ slug, categories }: { slug: string; categories: Category[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  function run(
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error?.message ?? "Erro");
      else {
        toast.success(success);
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-lg border">
        {categories.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            Nenhuma categoria. Ex.: Cabelo, Barba, Química.
          </li>
        )}
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            {editing?.id === c.id ? (
              <>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                  className="h-8"
                  aria-label="Nome da categoria"
                  autoFocus
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Salvar"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => renameCategoryAction(slug, c.id, editing.name),
                      "Categoria renomeada.",
                      () => setEditing(null),
                    )
                  }
                >
                  <CheckIcon aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Cancelar"
                  onClick={() => setEditing(null)}
                >
                  <XIcon aria-hidden />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{c.name}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Renomear ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  <PencilIcon aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button size="icon-sm" variant="ghost" aria-label={`Excluir ${c.name}`}>
                      <Trash2Icon aria-hidden />
                    </Button>
                  }
                  title={`Excluir a categoria ${c.name}?`}
                  description="Os serviços dessa categoria continuam existindo, mas ficam sem categoria."
                  confirmLabel="Excluir"
                  destructive
                  onConfirm={async () => {
                    const result = await deleteCategoryAction(slug, c.id);
                    if (!result.ok) return result.error.message;
                    toast.success("Categoria excluída.");
                    router.refresh();
                    return null;
                  }}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim())
            run(
              () => createCategoryAction(slug, newName),
              "Categoria criada.",
              () => setNewName(""),
            );
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova categoria"
          aria-label="Nova categoria"
        />
        <Button type="submit" variant="outline" disabled={pending || !newName.trim()}>
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <PlusIcon aria-hidden />
          )}
          Adicionar
        </Button>
      </form>
    </div>
  );
}
