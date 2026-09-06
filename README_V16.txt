V16 — CORREÇÃO DAS FOTOS DO CARDÁPIO VISUAL

Correção:
- A V15 usava o campo errado para carregar as imagens na vitrine.
- O projeto salva as fotos no campo "image", mas a vitrine estava procurando "photo".
- A V16 corrige isso e passa a usar as 11 fotos reais já existentes na pasta fotos/.

Mantido:
- Vitrine visual de Pratos, Lanches e Bebidas.
- Carrinho fixo.
- Botão + Adicionar.
- Status disponível/esgotado.
- Confirmação do pedido.
- IA com respostas curtas.

Para testar:
1. Copie a pasta node-v24.20.0-win-x64 para a V16.
2. Copie o arquivo .env da V15 para a V16.
3. Inicie por 4_INICIAR_GARCOM_SOMENTE_LOCAL.bat.
4. Clique em Pratos, Lanches e Bebidas e confira as fotos.
