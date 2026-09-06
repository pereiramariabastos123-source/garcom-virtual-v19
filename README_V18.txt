V18 — NOTIFICAÇÕES E STATUS DO PEDIDO

NOVO NO RESTAURANTE:
- Badge vermelho ao lado de "Pedidos" mostra quantos pedidos estão como Novo.
- Badge diminui quando o pedido entra em preparo.
- Aviso visual "Novo pedido — Mesa XX".
- Som curto quando chega um pedido novo.
- Pedidos ordenados: Novo -> Em preparo -> Pronto -> Finalizado.
- Pedidos novos recebem destaque visual.

NOVO NO CLIENTE:
- Depois de confirmar, o cliente vê o andamento:
  Recebido -> Em preparo -> Pronto.
- O status é atualizado automaticamente a cada 4 segundos.

TESTE:
1. Abra o painel administrativo.
2. Abra uma mesa em outra aba.
3. Faça e confirme um pedido.
4. Veja o badge vermelho em "Pedidos", o aviso e o som.
5. Em Pedidos, clique Iniciar preparo e depois Marcar pronto.
6. Volte à aba do cliente e veja o status mudar sozinho.

Para iniciar:
- copie node-v24.20.0-win-x64 para a V18
- copie o .env da V17 para a V18
- abra 4_INICIAR_GARCOM_SOMENTE_LOCAL.bat
