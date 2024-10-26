# Sara RECV

[網頁客戶端](https://github.com/web-tech-tw/sara) | 伺服器端

關於系統介紹、或想了解本系統資訊，請前往[這裡](https://github.com/web-tech-tw/sara)。

## 系統設定

### 安裝相依套件

本專案使用 Node.js 作為開發環境，請先安裝 Node.js。

該指令會安裝專案所需的相依套件。

```sh
npm install
```

### 自動化測試

本專案採用 Mocha 作為自動化測試框架。

該指令會執行所有測試案例。

```sh
npm run test
```

### 開發除錯模式

本專案採用 Nodemon 作為開發除錯工具。

該指令會啟動伺服器，並在程式碼變更時自動重啟伺服器。

```sh
npm run dev
```

## 金鑰腳本

生成金鑰腳本，請參閱以下指令。

### 生成安全金鑰

用於生成安全金鑰，作為 Secret 值使用。
    
```sh
openssl rand -base64 36
```
    
### 生成憑證公鑰與私鑰

用於生成憑證公鑰與私鑰，作為 JWT 簽名使用。
    
```sh
openssl ecparam -name prime256v1 -genkey -noout -out "keypair_private.pem"
openssl ec -in "keypair_private.pem" -pubout -out "keypair_public.pem"
```

### 正式產品模式

該指令會啟動伺服器。

```sh
npm start
```

## 開放原始碼授權

本專案採用 MIT 開放原始碼授權。

詳細可參閱 [LICENSE](LICENSE) 檔案。

---

&copy; [Taiwan Web Technology Promotion Organization](https://web-tech.tw)
