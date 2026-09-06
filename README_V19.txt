GARÇOM VIRTUAL — V19 ONLINE

V19 foi preparada para o primeiro teste real pelo celular.

NOVO
- QR Code preparado para endereço público.
- Mesa correta vem do QR e entra no pedido.
- Cardápio fica centralizado no servidor.
- Alteração feita no painel aparece no celular.
- IA consulta o cardápio oficial do servidor.
- Pedido e preço são validados no servidor.
- Painel pode ser protegido por ADMIN_PASSWORD.
- Chave OpenAI continua somente no servidor.
- Carrinho "Meu pedido" não aparece no painel administrativo.
- Cliente continua acompanhando Recebido -> Em preparo -> Pronto.

LOCAL
Copie a pasta node-v24.20.0-win-x64 e o .env da V18.
Depois abra 4_INICIAR_GARCOM_SOMENTE_LOCAL.bat.

ONLINE
Configure na hospedagem:
OPENAI_API_KEY
OPENAI_MODEL=gpt-5.6-luna
ADMIN_PASSWORD
PUBLIC_BASE_URL

Para produção, use armazenamento persistente para data/menu.json e data/orders.json.
