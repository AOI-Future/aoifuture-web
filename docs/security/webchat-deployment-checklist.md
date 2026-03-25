# WebChat Security Deployment Checklist

## Mandatory

- Nginx で `/api/webchat-intake` に `limit_req` を適用した
- Nginx で `Origin` を `aoifuture.com` / `nozaki.com` 系に限定した
- Nginx で `client_max_body_size 2k` を設定した
- Astro API で 1000 文字超の入力を拒否することを確認した
- Astro API で `Origin` 不一致時に `403` を返すことを確認した
- WebChat 連携先エージェントに `capabilities: "none"` を設定した
- 実行系ツールが 1 つも付いていないことを確認した
- 転送先は固定 webhook か固定 `message:send` のみで、シェル実行や任意 URL 呼び出しが無いことを確認した
- ブラウザ側で `maxlength="1000"` を設定した
- ブラウザ側で送信結果の表示に `innerHTML` ではなく `textContent` を使っていることを確認した

## Nice to have

- WAF または CDN 側でも `/api/webchat-intake` をレート制限した
- 監査ログに `flagged prompt injection` 件数だけを記録し、生の本文は過剰保存しない
- 相談内容を人手確認へ送る前に PII マスキングを追加した
