# 02 - Principios Operacionais

## Liberdade conversacional com trilho operacional

A LLM Atendente tem liberdade para conversar, mas nao tem liberdade para alterar a realidade.

Ela pode:

- adaptar tom;
- acolher o cliente;
- explicar;
- perguntar;
- negociar dentro da politica;
- perceber mudanca de assunto;
- conduzir a venda.

Ela nao pode:

- inventar preco;
- inventar estoque;
- prometer entrega sem dado;
- criar pedido sem confirmacao;
- alterar fatos historicos;
- escrever direto no banco.

## Formato de saida da Atendente

A Atendente nao devolve apenas texto. Ela devolve objeto estruturado.

```json
{
  "say": "Show, tenho uma opcao boa pra sua Bros 160. Quer priorizar preco ou durabilidade?",
  "actions": [
    {
      "type": "request_confirmation",
      "facts": [
        { "key": "moto_modelo", "value": "Bros 160" }
      ]
    }
  ]
}
```

`say` e conversa livre.

`actions` e trilho validado por codigo.

## Teste da regra

Toda regra nova precisa passar por esta pergunta:

```text
Se remover esta regra, o agente fica apenas menos elegante ou fica perigoso?
```

Se fica apenas menos elegante, nao vira regra de sistema.

Se fica perigoso, vira codigo, validador ou transacao.

## Nao criar regra para frase

Regra ruim:

```text
Se cliente disser "caro", comecar com "entendo seu ponto".
```

Isso e script. Mata a LLM.

Regra boa:

```text
Se resposta mencionar valor monetario, a skill precisa ter retornado preco.
```

Isso evita dano.

## Regras devem ser mais negativas que positivas

Regra negativa:

- nao mencionar preco sem fonte;
- nao criar pedido sem confirmacao;
- nao vender fitment nao aprovado como certeza;
- nao prosseguir se pagamento ja foi enviado sem humano.

Regra positiva demais vira chatbot antigo.

