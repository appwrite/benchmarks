FROM loadimpact/k6 AS k6

FROM alpine

COPY --from=k6 /usr/bin/k6 /usr/bin/k6

COPY . .

RUN chmod +x /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]
