GARÇOM VIRTUAL — SABOR DA CASA — V12 COM IA OPENAI

IMPORTANTE
A V12 não deve mais ser aberta clicando diretamente no index.html.
Agora ela usa um pequeno servidor para proteger a sua chave da OpenAI.

PASSO 1 — INSTALAR NODE.JS
Se você ainda não tiver Node.js:
https://nodejs.org/
Baixe a versão LTS e instale normalmente.

PASSO 2 — COLOCAR SUA CHAVE
Dê dois cliques em:
1_CONFIGURAR_CHAVE.bat

O Bloco de Notas abrirá.
Na linha:
OPENAI_API_KEY=cole_sua_chave_aqui

apague somente "cole_sua_chave_aqui" e cole sua chave.
Exemplo de formato:
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

Salve com CTRL+S e feche.

NUNCA envie o arquivo .env para clientes e nunca publique sua chave.

PASSO 3 — INICIAR
Dê dois cliques em:
2_INICIAR_GARCOM.bat

Na primeira vez, ele instalará os componentes necessários pela internet.
Depois o navegador abrirá:
http://localhost:3000

TESTE
Abra uma mesa no painel e converse normalmente:
- quero peixe
- sim
- quero uma bebida
- tem coca?
- quero
- tenho 30 reais
- o que você recomenda?
- quem descobriu o Brasil?

COMPORTAMENTO DA IA
- Respostas muito curtas.
- Só assuntos do restaurante.
- Usa o cardápio atual enviado pelo sistema.
- Não deve inventar preço, produto ou ingrediente.
- Entende respostas curtas usando o histórico.
- Pode mandar o sistema mostrar a foto armazenada.
- Se a API falhar, o protótipo volta automaticamente para o modo local da V11.

MODELO
Por padrão: gpt-5.6-luna, escolhido para reduzir custo em conversas curtas.
Você pode trocar no arquivo .env em OPENAI_MODEL.

OBSERVAÇÃO DO PROTÓTIPO
As alterações do cardápio continuam salvas no navegador (localStorage).
Em produção, o próximo passo será colocar cardápio, fotos e pedidos no servidor/banco de dados.
