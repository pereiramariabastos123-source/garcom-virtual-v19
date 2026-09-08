GARÇOM VIRTUAL V24 — BASE V19 REESTRUTURADA

Objetivo desta versão:
- preservar o que funcionava na V19;
- impedir que a IA escolha produto/foto errados;
- validar produtos, disponibilidade e observações pelo cardápio oficial;
- manter conversa natural limitada ao restaurante.

SEGURANÇA DE AÇÕES
A IA de linguagem não controla foto, carrinho ou observação.
Essas ações passam pelo chat-engine.js, que consulta o cardápio oficial.

Exemplos esperados:
"quero um x-salada e uma coca-cola"
-> adiciona exatamente X-Salada + Coca-Cola 350 ml e pergunta se deseja finalizar.

"sim"
-> abre Meu pedido para conferência; o envio só ocorre ao clicar Confirmar pedido.

"foto do x-salada" / "cadê a foto dele"
-> mostra apenas a foto vinculada ao X-Salada.

"quero um x-salada sem tomate"
-> adiciona X-Salada com Observação: Sem tomate.

"quero um x-salada sem verduras"
-> pergunta quais verduras retirar; não adivinha.

TESTES AUTOMÁTICOS
Execute: npm test
Resultado esperado: 45 verificações críticas + validação estrutural e das 11 fotos.

TESTE LOCAL NO WINDOWS
1. Copie a pasta node-v24.20.0-win-x64 para esta pasta.
2. Copie seu arquivo .env para esta pasta.
3. Execute 4_INICIAR_GARCOM_SOMENTE_LOCAL.bat.

Não publique no Render antes de concluir os testes locais.
