/**
 * Monta o prompt para a LLM Organizadora.
 *
 * O sistema instrui a LLM a extrair apenas fact_keys da whitelist.
 * O usuário recebe a transcrição da conversa.
 * Resposta esperada: JSON com schema_version + facts[].
 */

import type { OpenAIMessage } from '../shared/llm-clients/openai.js';
import type { MessageForPrompt } from '../shared/repositories/core-reader.repository.js';

const SCHEMA_VERSION = 'moto-pneus-v1';

// Fact keys permitidas (espelho da whitelist em zod/fact-keys.ts, sem importar o módulo inteiro aqui)
const ALLOWED_FACT_KEYS = [
  'moto_marca', 'moto_modelo', 'moto_ano', 'moto_cilindrada', 'moto_uso',
  'medida_pneu', 'posicao_pneu', 'marca_pneu_preferida', 'marca_pneu_recusada', 'quantidade_pneus',
  'intencao_cliente', 'motivo_compra', 'urgencia',
  'preferencia_principal', 'faixa_preco_desejada', 'aceita_alternativa',
  'bairro_mencionado', 'municipio_mencionado', 'modalidade_entrega', 'perguntou_entrega_hoje',
  'forma_pagamento',
  'pediu_desconto', 'perguntou_parcelamento', 'achou_caro',
  'concorrente_citado', 'preco_concorrente',
  'produto_oferecido', 'produto_aceito', 'produto_recusado_motivo',
  'pediu_humano',
  'nome_cliente',
].join(', ');

const SYSTEM_PROMPT = `Você é um extrator de dados estruturados de conversas de atendimento de uma loja de pneus de moto.

Sua tarefa: ler a conversa abaixo e extrair fatos relevantes sobre o cliente, o veículo e a intenção de compra.

REGRAS OBRIGATÓRIAS:
1. Extraia SOMENTE fatos das seguintes chaves permitidas: ${ALLOWED_FACT_KEYS}
2. Cada fato DEVE ter evidence_text: o trecho exato da mensagem que justifica o fato.
3. Cada fato DEVE ter from_message_id: o id da mensagem de onde veio o fato.
4. truth_type: "observed" (cliente disse explicitamente), "inferred" (claramente implícito), "corrected" (cliente corrigiu algo dito antes).
5. confidence_level: número entre 0.55 e 1.0. Abaixo de 0.55, não extraia o fato.
6. Se não tiver certeza suficiente, NÃO extraia. Prefira menos fatos corretos a mais fatos duvidosos.
7. NÃO invente fatos. NÃO use informações de fora da conversa.
8. Para campos booleanos: use true ou false (não strings).
9. Para medida_pneu: use o formato exato "140/70-17" (largura/perfil-aro).

Responda SOMENTE com JSON válido no seguinte formato:
{
  "schema_version": "${SCHEMA_VERSION}",
  "facts": [
    {
      "fact_key": "...",
      "fact_value": ...,
      "from_message_id": "uuid-da-mensagem",
      "evidence_text": "trecho exato da mensagem",
      "truth_type": "observed" | "inferred" | "corrected",
      "confidence_level": 0.0 a 1.0,
      "evidence_type": "literal" | "inferred" | "confirmed_by_question"
    }
  ],
  "reasoning": "breve explicação do que você encontrou (opcional, max 200 chars)"
}`;

/**
 * Formata a transcrição das mensagens como texto para incluir no prompt.
 * Inclui o id de cada mensagem para que a LLM possa referenciar no from_message_id.
 */
function formatTranscript(messages: MessageForPrompt[]): string {
  if (messages.length === 0) {
    return '(sem mensagens)';
  }

  return messages
    .map((msg) => {
      const role = msg.sender_type === 'contact' ? 'CLIENTE' : 'ATENDENTE';
      const content = (msg.content ?? '').trim();
      return `[msg_id: ${msg.id}] ${role}: ${content}`;
    })
    .join('\n');
}

/**
 * Monta o array de mensagens para a API da OpenAI.
 */
export function buildOrganizadoraPrompt(
  messages: MessageForPrompt[],
  conversationContext?: { contactName?: string | null; contactCity?: string | null },
): OpenAIMessage[] {
  const transcript = formatTranscript(messages);

  let userContent = `Analise a seguinte conversa de atendimento:\n\n${transcript}`;

  if (conversationContext?.contactName || conversationContext?.contactCity) {
    const extras: string[] = [];
    if (conversationContext.contactName) extras.push(`Nome no cadastro: ${conversationContext.contactName}`);
    if (conversationContext.contactCity) extras.push(`Cidade no cadastro: ${conversationContext.contactCity}`);
    userContent += `\n\nInformações do cadastro do cliente (use apenas se confirmado na conversa):\n${extras.join('\n')}`;
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}

export { SCHEMA_VERSION };
