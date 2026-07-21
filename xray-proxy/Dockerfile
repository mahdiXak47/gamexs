FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates unzip \
    && XRAY_VERSION=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])") \
    && curl -fsSL \
        "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip" \
        -o /tmp/xray.zip \
    && unzip /tmp/xray.zip xray -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/xray \
    && rm -rf /tmp/* /var/lib/apt/lists/*

WORKDIR /app
COPY find-fastest.py entrypoint.sh refresh.sh ./
RUN chmod +x entrypoint.sh refresh.sh

EXPOSE 10809

ENTRYPOINT ["./entrypoint.sh"]
