"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { createRequestAction } from "../actions";

const KINDS = [
  { value: "change_plan", label: "Mudar de plano" },
  { value: "extra_professionals", label: "Mais vagas de profissionais" },
  { value: "add_on", label: "Serviço adicional" },
  { value: "cancel", label: "Cancelar assinatura" },
  { value: "support", label: "Dúvida ou suporte" },
];

/** O estabelecimento solicita; quem executa é a equipe da plataforma (BILLING §13). */
export function RequestForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("change_plan");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <FormAlert message={error} />
      <Field>
        <FieldLabel htmlFor="rq-kind">Assunto</FieldLabel>
        <NativeSelect
          id="rq-kind"
          className="w-full"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {KINDS.map((k) => (
            <NativeSelectOption key={k.value} value={k.value}>
              {k.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="rq-msg">Mensagem</FieldLabel>
        <Textarea
          id="rq-msg"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await createRequestAction(slug, kind, message);
              if (!r.ok) setError(r.error.message);
              else {
                toast.success("Solicitação enviada.");
                setMessage("");
                router.refresh();
              }
            })
          }
        >
          Enviar solicitação
        </Button>
      </div>
    </div>
  );
}
