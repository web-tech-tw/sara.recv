# Sara RECV

[網頁客戶端](https://github.com/web-tech-tw/sara) | 伺服器端

關於系統介紹、或想了解本系統資訊，請前往[這裡](https://github.com/web-tech-tw/sara)。

## 伺服器腳本

### 自動化測試

```shell
npm run test
```

### 開發除錯模式

```shell
npm run dev
```

### 正式產品模式

```shell
npm start
```

## 金鑰腳本

### 生成安全金鑰

```sh
openssl rand -base64 36
```

### 生成憑證公鑰與私鑰

```sh
openssl ecparam -name prime256v1 -genkey -noout -out "keypair_private.pem"
openssl ec -in "keypair_private.pem" -pubout -out "keypair_public.pem"
```
