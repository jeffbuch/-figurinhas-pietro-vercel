# Figurinhas Pietro — PWA na Vercel

Este projeto é um app web/PWA para controle de figurinhas da Copa 2026 usando Google Sheets como banco de dados.

## Estrutura esperada da planilha

A aba precisa se chamar:

```text
Controle
```

A primeira linha precisa ter estas colunas:

```text
Grupo | País/Seção | Sigla | Número | Código | Status | Repetidas | Observações
```

O app procura as colunas pelo nome. Então mantenha esses nomes na primeira linha.

## Variáveis de ambiente

Na Vercel, vá em:

```text
Project > Settings > Environment Variables
```

Cadastre:

```text
GOOGLE_SHEET_ID
SHEET_NAME
GOOGLE_CLIENT_EMAIL
GOOGLE_PRIVATE_KEY
```

Exemplo:

```text
GOOGLE_SHEET_ID=10eFoeURnWYwITjPIrwzpUruBMvY4Rf6UrWWGCnK9vaI
SHEET_NAME=Controle
GOOGLE_CLIENT_EMAIL=figurinhas-sheets-api@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n
```

## Como pegar o GOOGLE_PRIVATE_KEY

Abra o JSON da Service Account e copie o valor completo do campo:

```json
"private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Na Vercel, cole o conteúdo sem as aspas externas.

Importante: mantenha os `\n` dentro da chave.

## Compartilhar a planilha

A planilha precisa estar compartilhada como `Editor` com o e-mail da Service Account:

```json
"client_email": "..."
```

## Deploy pela Vercel

1. Crie um repositório no GitHub.
2. Suba todos os arquivos deste projeto.
3. Entre na Vercel.
4. Clique em `Add New Project`.
5. Escolha o repositório.
6. Adicione as Environment Variables.
7. Clique em `Deploy`.

## Teste inicial

Depois do deploy, abra:

```text
https://seu-projeto.vercel.app
```

Teste nesta ordem:

1. Carregar dados da planilha.
2. Buscar por código, país ou grupo.
3. Marcar uma figurinha como Tenho.
4. Usar + e - em repetidas.
5. Conferir se a planilha mudou.
6. Testar Modo Troca.
7. Testar Scanner no iPhone pelo Safari.

## Scanner

O scanner usa câmera + OCR via Tesseract.js no navegador.

Como o código da figurinha é texto impresso, tipo `ARG4`, `BRA12`, `FIFA3` ou `CC1`, ele não é QR Code.

O app tenta reconhecer o texto pela câmera, mas também tem campo manual caso o OCR não leia direito.

deploy final
