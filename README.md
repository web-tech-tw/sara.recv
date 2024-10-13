# sara.recv

無密碼式身分認證系統。

A passwordless authentication system.

[應用程式介面/API]

## Testing

```shell
npm run test
```

## Development

```shell
npm run dev
```

## Production

```shell
npm start
```

## Keypair

```sh
openssl ecparam -name prime256v1 -genkey -noout -out "keypair_private.pem"
openssl ec -in "keypair_private.pem" -pubout -out "keypair_public.pem"
```
