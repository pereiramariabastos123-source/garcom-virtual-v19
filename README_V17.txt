V17 — PAINEL DE PEDIDOS DO RESTAURANTE

NOVO:
- Pedido confirmado pelo cliente agora é registrado no servidor local.
- Novo botão Pedidos no painel administrativo.
- Painel mostra Mesa, número do pedido, horário, itens e total.
- Status: Novo -> Em preparo -> Pronto -> Finalizado.
- Contadores de novos, em preparo e prontos.
- Atualização automática a cada 5 segundos.
- Pedidos salvos em data/orders.json.

TESTE:
1. Entre como cliente em uma mesa.
2. Adicione itens e confirme.
3. Volte ao painel administrativo.
4. Clique em Pedidos.
5. Teste Iniciar preparo -> Marcar pronto -> Finalizar.

Para iniciar, copie node-v24.20.0-win-x64 e o .env da V16 para a V17 e abra 4_INICIAR_GARCOM_SOMENTE_LOCAL.bat.
