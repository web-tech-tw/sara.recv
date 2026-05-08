FROM oven/bun:alpine

ENV TRUST_PROXY="uniquelocal"
ENV HTTP_HOSTNAME="0.0.0.0"
ENV RUNTIME_ENV="container"

RUN addgroup \
    -g 3000 \
    recv
RUN adduser -HD \
    -u 3000 \
    -G recv \
    -h /app \
    recv

WORKDIR /app
RUN chown 3000:3000 /app

USER 3000

COPY --chown=3000:3000 package.json ./
RUN bun install --production

COPY --chown=3000:3000 . .

EXPOSE 3000
CMD ["bun", "start"]
